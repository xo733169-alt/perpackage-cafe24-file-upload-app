import { getCafe24ApiBaseUrl, requireCafe24Config } from "./config";
import { getCafe24Installation, getValidCafe24AccessToken } from "./token-store";

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const FILE_ID_KEYWORDS = ["업로드 파일 ID", "파일 ID", "file_id", "파일접수번호"];
const SENSITIVE_KEY_PATTERN = /(token|secret|authorization|password|client_secret|access_token|refresh_token|signature)/i;

export type Cafe24OrderLookupItem = {
  productName: string | null;
  productNo: string | null;
  variantCode: string | null;
  quantity: string | null;
  itemOrderStatus: string | null;
  optionText: string | null;
  additionalOptionText: string | null;
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
    detailTopLevelKeys: string[];
    itemResponseTopLevelKeys: string[];
    hasOrderObject: boolean;
    hasOrdersArray: boolean;
    detailItemCount: number;
    itemArrayExists: boolean;
    itemCount: number;
    itemLookupStatus: "success" | "failed" | "not_attempted";
    itemLookupErrorMessage: string | null;
  };
};

type ItemLookupResult = {
  status: "success" | "failed" | "not_attempted";
  payload: unknown | null;
  errorMessage: string | null;
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

function getItemResponseItems(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];

  const candidates = [
    payload.items,
    payload.order_items,
    payload.products,
    isRecord(payload.order) ? payload.order.items : null,
    isRecord(payload.order) ? payload.order.order_items : null,
    isRecord(payload.order) ? payload.order.products : null
  ];

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

function collectOptionRelatedStrings(item: Record<string, unknown>, itemPath: string) {
  const output: Array<{ path: string; key: string; value: string }> = [];
  const optionKeys = [
    "option",
    "options",
    "option_value",
    "additional_option",
    "additional_options",
    "input_options",
    "product_option",
    "product_options",
    "variants",
    "custom_fields",
    "additional_info"
  ];

  optionKeys.forEach((key) => {
    if (key in item) {
      collectStrings(item[key], `${itemPath}.${key}`, output);
    }
  });

  return output;
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

function summarizeOptionText(item: Record<string, unknown>, itemPath: string) {
  const direct = firstString(item, [
    "option_value",
    "option",
    "product_option",
    "product_options",
    "variant_code"
  ]);
  if (direct) return direct;

  const strings = collectOptionRelatedStrings(item, itemPath);
  return strings.slice(0, 6).map((entry) => entry.value).filter(Boolean).join(" / ") || null;
}

function summarizeAdditionalOptionText(item: Record<string, unknown>, itemPath: string) {
  const strings: Array<{ path: string; key: string; value: string }> = [];
  [
    "additional_option",
    "additional_options",
    "input_options",
    "custom_fields",
    "additional_info"
  ].forEach((key) => {
    if (key in item) collectStrings(item[key], `${itemPath}.${key}`, strings);
  });

  return strings.slice(0, 8).map((entry) => entry.value).filter(Boolean).join(" / ") || null;
}

export function summarizeCafe24OrderLookup({
  detailPayload,
  itemPayload,
  itemLookupStatus,
  itemLookupErrorMessage,
  tokenLookupMallId
}: {
  detailPayload: unknown;
  itemPayload: unknown | null;
  itemLookupStatus: "success" | "failed" | "not_attempted";
  itemLookupErrorMessage: string | null;
  tokenLookupMallId: string;
}): Cafe24OrderLookupSummary {
  const detailRecord = isRecord(detailPayload) ? detailPayload : {};
  const itemRecord = isRecord(itemPayload) ? itemPayload : {};
  const order = getOrderObject(detailPayload);
  const detailItems = getOrderItems(order);
  const itemResponseItems = getItemResponseItems(itemPayload);
  const sourceItems = itemResponseItems.length ? itemResponseItems : detailItems;
  const sourcePathPrefix = itemResponseItems.length ? "orderItemResponse.items" : "order.items";
  const summarizedItems = sourceItems.map((item, index) => {
    const itemPath = `${sourcePathPrefix}[${index}]`;
    const uploadInfo = extractUploadFileIdsFromItem(item, itemPath);

    return {
      productName: firstString(item, [
        "product_name",
        "product_name_default",
        "productName",
        "productNameDefault",
        "item_name",
        "itemName",
        "product_name_en"
      ]),
      productNo: firstString(item, ["product_no", "productNo"]),
      variantCode: firstString(item, ["variant_code", "variantCode"]),
      quantity: firstString(item, ["quantity"]),
      itemOrderStatus: firstString(item, ["order_status"]),
      optionText: summarizeOptionText(item, itemPath),
      additionalOptionText: summarizeAdditionalOptionText(item, itemPath),
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
      detailTopLevelKeys: Object.keys(detailRecord).sort(),
      itemResponseTopLevelKeys: Object.keys(itemRecord).sort(),
      hasOrderObject: isRecord(detailRecord.order),
      hasOrdersArray: Array.isArray(detailRecord.orders),
      detailItemCount: detailItems.length,
      itemArrayExists: itemResponseItems.length > 0,
      itemCount: sourceItems.length,
      itemLookupStatus,
      itemLookupErrorMessage
    }
  };
}

async function fetchCafe24Json(endpoint: string, accessToken: string, apiVersion: string) {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Cafe24-Api-Version": apiVersion
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Cafe24 request failed with status ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

export async function fetchCafe24OrderLookup(orderId: string, mallId?: string | null) {
  const trimmedOrderId = orderId.trim();
  if (!trimmedOrderId) {
    throw new Error("Cafe24 order_id is required.");
  }

  const config = requireCafe24Config();
  const tokenLookupMallId = mallId?.trim() || config.mallId;
  const accessToken = await getValidCafe24AccessToken(tokenLookupMallId);
  const apiBaseUrl = getCafe24ApiBaseUrl(tokenLookupMallId);
  const detailEndpoint = `${apiBaseUrl}/api/v2/admin/orders/${encodeURIComponent(trimmedOrderId)}`;
  const detailPayload = await fetchCafe24Json(detailEndpoint, accessToken, config.apiVersion);
  let itemLookup: ItemLookupResult = {
    status: "not_attempted",
    payload: null,
    errorMessage: null
  };

  try {
    const installation = await getCafe24Installation(tokenLookupMallId);
    const itemUrl = new URL(`${apiBaseUrl}/api/v2/admin/orders/${encodeURIComponent(trimmedOrderId)}/items`);
    if (installation?.shop_no) {
      itemUrl.searchParams.set("shop_no", installation.shop_no);
    }

    itemLookup = {
      status: "success",
      payload: await fetchCafe24Json(itemUrl.toString(), accessToken, config.apiVersion),
      errorMessage: null
    };
  } catch (error) {
    itemLookup = {
      status: "failed",
      payload: null,
      errorMessage: error instanceof Error ? error.message : "Cafe24 order item lookup failed."
    };
  }

  return summarizeCafe24OrderLookup({
    detailPayload,
    itemPayload: itemLookup.payload,
    itemLookupStatus: itemLookup.status,
    itemLookupErrorMessage: itemLookup.errorMessage,
    tokenLookupMallId
  });
}
