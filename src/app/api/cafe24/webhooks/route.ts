import { NextRequest, NextResponse } from "next/server";
import { fetchCafe24OrderLookup } from "@/lib/cafe24/order-lookup";
import {
  createCafe24WebhookEvent,
  type Cafe24WebhookEventRecord,
  type Cafe24WebhookProcessedStatus,
  extractCafe24WebhookEventType,
  extractCafe24WebhookMallId,
  extractCafe24WebhookOrderId,
  sanitizeJsonValue,
  summarizeHeaders,
  updateCafe24WebhookEventProcessing
} from "@/lib/cafe24/webhook-events";
import { getFileById, updateFileOrderId } from "@/lib/files/file-service";
import { createFileOrderLinkLog } from "@/lib/files/order-link-log-service";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

type AutoLinkResult = {
  processedStatus: Cafe24WebhookProcessedStatus;
  errorMessage: string | null;
  linkedCount: number;
  alreadyLinkedCount: number;
  notFoundCount: number;
  conflictCount: number;
};

function buildAutoLinkSummary(input: Omit<AutoLinkResult, "processedStatus" | "errorMessage">) {
  return [
    `auto_linked=${input.linkedCount}`,
    `already_linked=${input.alreadyLinkedCount}`,
    `file_not_found=${input.notFoundCount}`,
    `conflict_order_id=${input.conflictCount}`
  ].join(", ");
}

function getFinalProcessedStatus(input: Omit<AutoLinkResult, "processedStatus" | "errorMessage">): Cafe24WebhookProcessedStatus {
  if (input.linkedCount > 0) return "auto_linked";
  if (input.alreadyLinkedCount > 0 && input.notFoundCount === 0 && input.conflictCount === 0) return "already_linked";
  if (input.conflictCount > 0) return "conflict_order_id";
  if (input.notFoundCount > 0) return "file_not_found";
  return "failed";
}

async function processWebhookAutoLink(event: Cafe24WebhookEventRecord): Promise<Cafe24WebhookEventRecord> {
  const orderId = event.order_id?.trim();
  if (!orderId) {
    return updateCafe24WebhookEventProcessing({
      id: event.id,
      processedStatus: "no_order_id",
      errorMessage: "No order_id found in webhook payload."
    });
  }

  try {
    const order = await fetchCafe24OrderLookup(orderId, event.mall_id);
    if (order.responseShape.itemLookupStatus === "failed") {
      return updateCafe24WebhookEventProcessing({
        id: event.id,
        processedStatus: "failed",
        errorMessage: order.responseShape.itemLookupErrorMessage ?? "Cafe24 order item lookup failed.",
        orderId
      });
    }

    const fileIds = order.uploadFileIds;

    if (!fileIds.length) {
      return updateCafe24WebhookEventProcessing({
        id: event.id,
        processedStatus: "no_file_id",
        errorMessage: "No upload file id found from Cafe24 order items.",
        orderId
      });
    }

    const result = {
      linkedCount: 0,
      alreadyLinkedCount: 0,
      notFoundCount: 0,
      conflictCount: 0
    };

    for (const fileId of fileIds) {
      const file = await getFileById(fileId);
      if (!file) {
        result.notFoundCount += 1;
        continue;
      }

      const currentOrderId = file.order_id?.trim() ?? "";
      if (!currentOrderId) {
        await updateFileOrderId({ fileId, orderId });
        await createFileOrderLinkLog({
          fileId,
          previousOrderId: null,
          newOrderId: orderId,
          linkSource: "webhook",
          webhookEventId: event.id,
          adminUser: "system",
          memo: "Cafe24 Webhook order.received 자동 연결"
        });
        result.linkedCount += 1;
        continue;
      }

      if (currentOrderId === orderId) {
        result.alreadyLinkedCount += 1;
        continue;
      }

      result.conflictCount += 1;
    }

    const processedStatus = getFinalProcessedStatus(result);
    const summary = buildAutoLinkSummary(result);
    const errorMessage = processedStatus === "auto_linked" || processedStatus === "already_linked"
      ? summary
      : processedStatus === "conflict_order_id"
        ? `File already linked to another order_id. ${summary}`
        : processedStatus === "file_not_found"
          ? `File not found in Supabase files. ${summary}`
          : `Webhook auto link failed. ${summary}`;

    return updateCafe24WebhookEventProcessing({
      id: event.id,
      processedStatus,
      errorMessage,
      orderId
    });
  } catch (error) {
    console.error("cafe24_webhook_auto_link_failed", {
      eventId: event.id,
      orderId,
      message: error instanceof Error ? error.message : "Unknown error"
    });

    return updateCafe24WebhookEventProcessing({
      id: event.id,
      processedStatus: "failed",
      errorMessage: error instanceof Error ? error.message : "Webhook auto link failed.",
      orderId
    });
  }
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
    let processedEvent = event;

    try {
      processedEvent = await processWebhookAutoLink(event);
    } catch (processingError) {
      console.error("cafe24_webhook_processing_update_failed", {
        eventId: event.id,
        orderId: event.order_id,
        message: processingError instanceof Error ? processingError.message : "Unknown error"
      });
    }

    return NextResponse.json({
      ok: true,
      id: processedEvent.id,
      mall_id: processedEvent.mall_id,
      event_type: processedEvent.event_type,
      order_id: processedEvent.order_id,
      processed_status: processedEvent.processed_status,
      error_message: processedEvent.error_message,
      processing_completed: processedEvent.id === event.id && processedEvent.processed_status !== "received"
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
