import { getCafe24ApiBaseUrl, requireCafe24Config } from "./config";
import { getCafe24Installation, getValidCafe24AccessToken } from "./token-store";

export type Cafe24ProductVariantSummary = {
  variantCode: string | null;
  optionValues: string[];
  additionalAmount: number | null;
  display: string | null;
  selling: string | null;
};

export type Cafe24ProductPriceSummary = {
  sellingPrice: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function asAmount(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function extractOptionValues(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isRecord(item)) {
          return asText(item.option_value ?? item.value ?? item.optionValue ?? item.name);
        }
        return asText(item);
      })
      .filter((item): item is string => Boolean(item));
  }

  if (!isRecord(value)) return [];

  const nestedValues = value.option_value ?? value.value ?? value.optionValue;
  if (Array.isArray(nestedValues)) {
    return nestedValues.map(asText).filter((item): item is string => Boolean(item));
  }

  const direct = asText(nestedValues);
  return direct ? [direct] : [];
}

function getVariantRows(payload: unknown) {
  if (!isRecord(payload)) return [];

  const candidates = [payload.variants, payload.items, payload.product_variants];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }

  return [];
}

function getProductRecord(payload: unknown) {
  if (!isRecord(payload)) return null;

  const candidates = [payload.product, payload.products, payload.item];
  for (const candidate of candidates) {
    if (isRecord(candidate)) return candidate;
    if (Array.isArray(candidate) && isRecord(candidate[0])) return candidate[0];
  }

  return payload;
}

function summarizeVariant(row: Record<string, unknown>): Cafe24ProductVariantSummary {
  return {
    variantCode: asText(row.variant_code ?? row.variantCode ?? row.code),
    optionValues: extractOptionValues(row.options ?? row.option_values ?? row.option_value),
    additionalAmount: asAmount(row.additional_amount ?? row.additionalAmount),
    display: asText(row.display),
    selling: asText(row.selling)
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
    throw new Error(`Cafe24 variant lookup failed with status ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

export async function fetchCafe24ProductVariants(
  productNo: string,
  mallId?: string | null,
  resolvedAccessToken?: string
) {
  const normalizedProductNo = productNo.trim();
  if (!/^\d+$/.test(normalizedProductNo)) {
    throw new Error("Cafe24 product_no is invalid.");
  }

  const config = requireCafe24Config();
  const resolvedMallId = mallId?.trim() || config.mallId;
  const installation = await getCafe24Installation(resolvedMallId);
  const accessToken = resolvedAccessToken ?? await getValidCafe24AccessToken(resolvedMallId);
  const apiBaseUrl = getCafe24ApiBaseUrl(resolvedMallId);
  const url = new URL(`${apiBaseUrl}/api/v2/admin/products/${encodeURIComponent(normalizedProductNo)}/variants`);
  if (installation?.shop_no) {
    url.searchParams.set("shop_no", installation.shop_no);
  }

  return getVariantRows(await fetchCafe24Json(url.toString(), accessToken, config.apiVersion)).map(summarizeVariant);
}

export async function fetchCafe24ProductSellingPrice(
  productNo: string,
  mallId?: string | null,
  resolvedAccessToken?: string
) {
  const normalizedProductNo = productNo.trim();
  if (!/^\d+$/.test(normalizedProductNo)) {
    throw new Error("Cafe24 product_no is invalid.");
  }

  const config = requireCafe24Config();
  const resolvedMallId = mallId?.trim() || config.mallId;
  const installation = await getCafe24Installation(resolvedMallId);
  const accessToken = resolvedAccessToken ?? await getValidCafe24AccessToken(resolvedMallId);
  const url = new URL(`${getCafe24ApiBaseUrl(resolvedMallId)}/api/v2/admin/products/${encodeURIComponent(normalizedProductNo)}`);
  if (installation?.shop_no) {
    url.searchParams.set("shop_no", installation.shop_no);
  }

  const product = getProductRecord(await fetchCafe24Json(url.toString(), accessToken, config.apiVersion));
  return {
    sellingPrice: product ? asAmount(product.price ?? product.selling_price ?? product.sellingPrice) : null
  } satisfies Cafe24ProductPriceSummary;
}
