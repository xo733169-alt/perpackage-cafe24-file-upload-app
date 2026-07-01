import { NextRequest, NextResponse } from "next/server";
import {
  createCafe24WebhookEvent,
  extractCafe24WebhookEventType,
  extractCafe24WebhookMallId,
  extractCafe24WebhookOrderId,
  sanitizeJsonValue,
  summarizeHeaders
} from "@/lib/cafe24/webhook-events";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  try {
    const event = await createCafe24WebhookEvent({
      payload: body,
      headers: request.headers
    });

    return NextResponse.json({
      ok: true,
      id: event.id,
      mall_id: event.mall_id,
      event_type: event.event_type,
      order_id: event.order_id,
      processed_status: event.processed_status
    });
  } catch (error) {
    const headersSummary = summarizeHeaders(request.headers);
    const sanitizedPayload = sanitizeJsonValue(body);

    console.error("cafe24_webhook_receive_failed", {
      mallId: extractCafe24WebhookMallId(sanitizedPayload),
      orderId: extractCafe24WebhookOrderId(sanitizedPayload),
      eventType: extractCafe24WebhookEventType(sanitizedPayload, headersSummary),
      message: error instanceof Error ? error.message : "Unknown error"
    });

    return jsonError("Failed to store Cafe24 webhook event.", 500);
  }
}
