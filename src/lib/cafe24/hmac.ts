import crypto from "node:crypto";
import type { Cafe24LaunchParams, SafeCafe24LaunchContext } from "./types";

const LAUNCH_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type Cafe24LaunchValidationResult = {
  ok: boolean;
  reason: "valid" | "missing_secret" | "missing_hmac" | "timestamp_invalid" | "timestamp_expired" | "hmac_mismatch";
  context: SafeCafe24LaunchContext;
};

export function toLaunchParams(searchParams: URLSearchParams): Cafe24LaunchParams {
  return {
    auth_config: searchParams.get("auth_config") ?? undefined,
    is_multi_shop: searchParams.get("is_multi_shop") ?? undefined,
    lang: searchParams.get("lang") ?? undefined,
    mall_id: searchParams.get("mall_id") ?? undefined,
    nation: searchParams.get("nation") ?? undefined,
    shop_no: searchParams.get("shop_no") ?? undefined,
    timestamp: searchParams.get("timestamp") ?? undefined,
    user_id: searchParams.get("user_id") ?? undefined,
    user_name: searchParams.get("user_name") ?? undefined,
    user_type: searchParams.get("user_type") ?? undefined,
    hmac: searchParams.get("hmac") ?? undefined
  };
}

export function getSafeLaunchContext(params: Cafe24LaunchParams): SafeCafe24LaunchContext {
  return {
    mallId: params.mall_id?.trim() || null,
    shopNo: params.shop_no?.trim() || null,
    lang: params.lang?.trim() || null,
    nation: params.nation?.trim() || null,
    userId: params.user_id?.trim() || null,
    userName: params.user_name?.trim() || null,
    userType: params.user_type?.trim() || null,
    isMultiShop: params.is_multi_shop?.trim() || null
  };
}

export function buildCafe24HmacBaseString(searchParams: URLSearchParams): string {
  const entries = Array.from(searchParams.entries())
    .filter(([key]) => key !== "hmac")
    .sort(([left], [right]) => left.localeCompare(right));

  const canonical = new URLSearchParams();

  for (const [key, value] of entries) {
    canonical.append(key, value);
  }

  return canonical.toString();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createCafe24LaunchHmac(searchParams: URLSearchParams, clientSecret: string): string {
  return crypto
    .createHmac("sha256", clientSecret)
    .update(buildCafe24HmacBaseString(searchParams))
    .digest("base64");
}

function parseCafe24Timestamp(value: string | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return null;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

export function validateCafe24Launch({
  searchParams,
  clientSecret,
  now = Date.now()
}: {
  searchParams: URLSearchParams;
  clientSecret: string;
  now?: number;
}): Cafe24LaunchValidationResult {
  const params = toLaunchParams(searchParams);
  const context = getSafeLaunchContext(params);

  if (!clientSecret) return { ok: false, reason: "missing_secret", context };
  if (!params.hmac) return { ok: false, reason: "missing_hmac", context };

  const timestamp = parseCafe24Timestamp(params.timestamp);

  if (!timestamp) return { ok: false, reason: "timestamp_invalid", context };
  if (Math.abs(now - timestamp) > LAUNCH_MAX_AGE_MS) return { ok: false, reason: "timestamp_expired", context };

  const expected = createCafe24LaunchHmac(searchParams, clientSecret);
  const ok = safeEqual(expected, params.hmac);

  return { ok, reason: ok ? "valid" : "hmac_mismatch", context };
}
