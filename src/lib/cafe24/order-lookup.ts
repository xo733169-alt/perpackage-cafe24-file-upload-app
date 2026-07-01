import { getCafe24ApiBaseUrl, requireCafe24Config } from "./config";
import { getValidCafe24AccessToken } from "./token-store";

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const FILE_ID_KEYWORDS = ["업로드 파일 ID", "파일 ID", "file_id", "파일접수번호"];
const SENSITIVE_KEY_PATTERN = /(token|secret|authorization|password|client_secret|access_token|refresh_token|signature)/i;

export type Cafe24OrderLookupItem = {
  productName: string | null;
  productNo: string | null;
  variantCode: string | null;
  optionText: string | null;
  uploadFileIds: string[];
  uploadFileIdSources: string[];
};

export type Cafe24OrderLookupSummary = {
  tokenLookupMallId: string;
  orderId: string | null;
  orderNo: string | null;
  orderedAt: string | null;
  orderStatus: string | null;
  items: Cafe24OrderLookupItem[];
  uploadFileIds: string[];
  responseShape: {
    topLevelKeys: string[];
    hasOrderObject: boolean;
    hasOrdersArray: boolean;
    itemCount: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function getOrderObject(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.order)) return payload.order;
  if (Array.isArray(payload.orders) && isRecord(payload.orders[0])) return payload.orders[0];
  return null;
}

function getOrderItems(order: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!order) return [];
  const candidates = [order.items, order.order_items, order.products];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }
  return [];
}

function collectStrings(value: unknown, path: string, output: Array<{ path: string; key: string; value: string }>) {
  if (typeof value === "string") {
    const key = path.split(".").pop() ?? path;
    if (!SENSITIVE_KEY_PATTERN.test(key)) {
      output.push({ path, key, value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, output));
    return;
  }

  if (isRecord(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (!SENSITIVE_KEY_PATTERN.test(key)) {
        collectStrings(nestedValue, `${path}.${key}`, output);
      }
    }
  }
}

function extractUploadFileIdsFromItem(item: Record<string, unknown>, itemPath: string) {
  const strings: Array<{ path: string; key: string; value: string }> = [];
  collectStrings(item, itemPath, strings);

  const found = new Map<string, string>();
  strings.forEach((entry, index) => {
    const matches = entry.value.match(UUID_PATTERN) ?? [];
    if (!matches.length) return;

    const previousEntry = strings[index - 1];
    const nearbyText = `${entry.key} ${entry.value} ${previousEntry?.key ?? ""} ${previousEntry?.value ?? ""}`;
    const hasFileIdLabel = FILE_ID_KEYWORDS.some((keyword) => nearbyText.toLowerCase().includes(keyword.toLowerCase()));

    matches.forEach((match) => {
      const normalized = match.toLowerCase();
      const source = hasFileIdLabel ? entry.path : `${entry.path} (uuid)`;
      if (!found.has(normalized)) found.set(normalized, source);
    });
  });

  return {
    uploadFileIds: Array.from(found.keys()),
    uploadFileIdSources: Array.from(found.values())
  };
}

function summarizeOptionText(item: Record<string, unknown>) {
  const direct = firstString(item, [
    "option_value",
    "option",
    "options",
    "product_option",
    "product_options",
    "variant_code"
  ]);
  if (direct) return direct;

  const strings: Array<{ path: string; key: string; value: string }> = [];
  collectStrings(item.options ?? item.additional_options ?? item.input_options ?? item.product_options, "item.options", strings);
  return strings.slice(0, 6).map((entry) => entry.value).filter(Boolean).join(" / ") || null;
}

export function summarizeCafe24OrderLookup(payload: unknown, tokenLookupMallId: string): Cafe24OrderLookupSummary {
  const payloadRecord = isRecord(payload) ? payload : {};
  const order = getOrderObject(payload);
  const items = getOrderItems(order);
  const summarizedItems = items.map((item, index) => {
    const uploadInfo = extractUploadFileIdsFromItem(item, `order.items[${index}]`);
    return {
      productName: firstString(item, ["product_name", "product_name_default", "productName", "productNameDefault", "item_name", "itemName", "product_name_en"]),
      productNo: firstString(item, ["product_no", "productNo"]),
      variantCode: firstString(item, ["variant_code", "variantCode"]),
      optionText: summarizeOptionText(item),
      uploadFileIds: uploadInfo.uploadFileIds,
      uploadFileIdSources: uploadInfo.uploadFileIdSources
    };
  });
  const uploadFileIds = Array.from(new Set(summarizedItems.flatMap((item) => item.uploadFileIds)));

  return {
    tokenLookupMallId,
    orderId: order ? firstString(order, ["order_id", "orderId"]) : null,
    orderNo: order ? firstString(order, ["order_no", "orderNo"]) : null,
    orderedAt: order ? firstString(order, ["ordered_date", "order_date", "created_date", "payed_date"]) : null,
    orderStatus: order ? firstString(order, ["order_status", "status", "shipping_status", "payment_status"]) : null,
    items: summarizedItems,
    uploadFileIds,
    responseShape: {
      topLevelKeys: Object.keys(payloadRecord).sort(),
      hasOrderObject: isRecord(payloadRecord.order),
      hasOrdersArray: Array.isArray(payloadRecord.orders),
      itemCount: items.length
    }
  };
}

export async function fetchCafe24OrderLookup(orderId: string, mallId?: string | null) {
  const trimmedOrderId = orderId.trim();
  if (!trimmedOrderId) {
    throw new Error("Cafe24 order_id is required.");
  }

  const config = requireCafe24Config();
  const tokenLookupMallId = mallId?.trim() || config.mallId;
  const accessToken = await getValidCafe24AccessToken(tokenLookupMallId);
  const endpoint = `${getCafe24ApiBaseUrl(tokenLookupMallId)}/api/v2/admin/orders/${encodeURIComponent(trimmedOrderId)}`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Cafe24-Api-Version": config.apiVersion
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Cafe24 order lookup failed with status ${response.status}.`);
  }

  const payload = await response.json() as unknown;
  return summarizeCafe24OrderLookup(payload, tokenLookupMallId);
}
