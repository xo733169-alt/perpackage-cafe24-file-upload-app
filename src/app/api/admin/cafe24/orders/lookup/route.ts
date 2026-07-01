import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import { fetchCafe24OrderLookup } from "@/lib/cafe24/order-lookup";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
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
    const order = await fetchCafe24OrderLookup(orderId);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cafe24 order lookup failed.";
    return jsonError(message, 400);
  }
}
