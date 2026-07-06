import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import { getCafe24ApiBaseUrl, requireCafe24Config } from "@/lib/cafe24/config";
import { getCafe24Installation, getValidCafe24AccessToken } from "@/lib/cafe24/token-store";

export const dynamic = "force-dynamic";

type FieldCheckResult = {
  field: string;
  status: "present" | "missing";
  type: string;
};

const ORDER_FIELD_PATHS = [
  "order.buyer_name",
  "order.member_name",
  "order.billing_name",
  "order.orderer_name",
  "order.buyer_email",
  "order.email",
  "order.orderer_email",
  "order.buyer_cellphone",
  "order.buyer_mobile",
  "order.orderer_mobile",
  "order.buyer_phone",
  "order.orderer_phone",
  "order.receiver_name",
  "order.recipient_name",
  "order.shipping_name",
  "order.receiver_cellphone",
  "order.receiver_mobile",
  "order.receiver_phone",
  "order.shipping_mobile",
  "order.shipping_phone",
  "order.shipping_address",
  "order.receiver_address",
  "order.address1",
  "order.address2",
  "order.receiver_address1",
  "order.receiver_address2",
  "order.shipping_message",
  "order.request_message",
  "order.order_memo",
  "order.member_id",
  "order.user_id",
  "order.customer_id",
  "order.quantity",
  "order.total_quantity",
  "order.order_quantity",
  "order.order_status",
  "order.status",
  "order.shipping_status",
  "order.delivery_status",
  "order.payment_status",
  "order.pay_status",
  "order.customer_message"
];

const ITEM_FIELD_NAMES = [
  "quantity",
  "product_quantity",
  "qty",
  "order_quantity",
  "item_status",
  "order_item_status",
  "status",
  "shipping_status",
  "delivery_status"
];

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getOrderObject(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.order)) return payload.order;
  if (Array.isArray(payload.orders) && isRecord(payload.orders[0])) return payload.orders[0];
  return null;
}

function getOrderItems(order: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!order) return [];

  for (const key of ["items", "order_items", "products"]) {
    const value = order[key];
    if (Array.isArray(value)) return value.filter(isRecord);
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
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }

  return [];
}

function valueType(value: unknown) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function isPresent(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function checkField(field: string, value: unknown): FieldCheckResult {
  return {
    field,
    status: isPresent(value) ? "present" : "missing",
    type: value === undefined ? "undefined" : valueType(value)
  };
}

function checkOrderField(path: string, order: Record<string, unknown> | null): FieldCheckResult {
  const key = path.replace(/^order\./, "");
  return checkField(path, order?.[key]);
}

function checkItemField(path: string, items: Record<string, unknown>[]): FieldCheckResult {
  const key = path.split(".").pop() ?? "";
  const values = items.map((item) => item[key]).filter((value) => value !== undefined);
  const firstPresentValue = values.find(isPresent);
  return checkField(path, firstPresentValue ?? values[0]);
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
    throw new Error("Cafe24 field check request failed.");
  }

  return response.json() as Promise<unknown>;
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(sessionToken)) {
    return jsonError("Unauthorized.", 401);
  }

  const orderId = request.nextUrl.searchParams.get("order_id")?.trim() ?? "";
  if (!orderId) {
    return jsonError("order_id is required.", 400);
  }

  try {
    const config = requireCafe24Config();
    const accessToken = await getValidCafe24AccessToken(config.mallId);
    const apiBaseUrl = getCafe24ApiBaseUrl(config.mallId);
    const detailEndpoint = `${apiBaseUrl}/api/v2/admin/orders/${encodeURIComponent(orderId)}`;
    const detailPayload = await fetchCafe24Json(detailEndpoint, accessToken, config.apiVersion);
    const order = getOrderObject(detailPayload);
    const detailItems = getOrderItems(order);

    let itemPayload: unknown | null = null;
    try {
      const installation = await getCafe24Installation(config.mallId);
      const itemUrl = new URL(`${apiBaseUrl}/api/v2/admin/orders/${encodeURIComponent(orderId)}/items`);
      if (installation?.shop_no) {
        itemUrl.searchParams.set("shop_no", installation.shop_no);
      }

      itemPayload = await fetchCafe24Json(itemUrl.toString(), accessToken, config.apiVersion);
    } catch {
      itemPayload = null;
    }

    const itemResponseItems = getItemResponseItems(itemPayload);
    const checks = [
      ...ORDER_FIELD_PATHS.map((path) => checkOrderField(path, order)),
      ...ITEM_FIELD_NAMES.map((field) => checkItemField(`order.items[*].${field}`, detailItems)),
      ...ITEM_FIELD_NAMES.map((field) => checkItemField(`orderItemResponse.items[*].${field}`, itemResponseItems))
    ];

    return NextResponse.json(checks);
  } catch {
    return jsonError("Cafe24 field check failed.", 400);
  }
}
