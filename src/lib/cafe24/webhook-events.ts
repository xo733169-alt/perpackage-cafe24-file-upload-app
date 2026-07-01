import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SENSITIVE_KEY_PATTERN = /(authorization|access_token|refresh_token|client_secret|secret|token|signature|password|cookie|api[-_]?key)/i;
const MAX_STRING_LENGTH = 1000;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Cafe24WebhookEventRecord = {
  id: string;
  mall_id: string | null;
  event_type: string;
  order_id: string | null;
  payload: JsonValue;
  headers_summary: Record<string, string>;
  received_at: string;
  processed_status: string;
  error_message: string | null;
  created_at: string;
};

export type Cafe24WebhookProcessedStatus =
  | "received"
  | "auto_linked"
  | "already_linked"
  | "no_order_id"
  | "no_file_id"
  | "file_not_found"
  | "conflict_order_id"
  | "failed";

export type Cafe24WebhookPayloadSummary = {
  topLevelKeys: string[];
  mallId: string | null;
  orderId: string | null;
  eventType: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function truncate(value: string, maxLength = MAX_STRING_LENGTH) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function getNestedRecordValue(payload: unknown, path: string[]) {
  let current: unknown = payload;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }

    if (!isRecord(current)) return null;
    current = current[segment];
  }

  return asString(current);
}

function getNestedUnknownValue(payload: unknown, path: string[]) {
  let current: unknown = payload;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }

    if (!isRecord(current)) return null;
    current = current[segment];
  }

  return current ?? null;
}

export function sanitizeJsonValue(value: unknown, key = "", depth = 0): JsonValue {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[masked]";
  }

  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return truncate(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth > 8) return "[truncated]";
    return value.slice(0, 100).map((item) => sanitizeJsonValue(item, key, depth + 1));
  }

  if (isRecord(value)) {
    if (depth > 8) return "[truncated]";
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([nestedKey, nestedValue]) => [nestedKey, sanitizeJsonValue(nestedValue, nestedKey, depth + 1)])
    );
  }

  return String(value);
}

export function summarizeHeaders(headers: Headers): Record<string, string> {
  const summary: Record<string, string> = {};

  headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
      summary[normalizedKey] = "[masked]";
      return;
    }

    summary[normalizedKey] = truncate(value, 300);
  });

  return summary;
}

export function extractCafe24WebhookOrderId(payload: unknown): string | null {
  return (
    getNestedRecordValue(payload, ["order_id"]) ||
    getNestedRecordValue(payload, ["order", "order_id"]) ||
    getNestedRecordValue(payload, ["resource", "order_id"]) ||
    getNestedRecordValue(payload, ["data", "order_id"]) ||
    getNestedRecordValue(payload, ["event", "order_id"]) ||
    getNestedRecordValue(payload, ["orders", "0", "order_id"])
  );
}

export function extractCafe24WebhookMallId(payload: unknown): string | null {
  return (
    getNestedRecordValue(payload, ["mall_id"]) ||
    getNestedRecordValue(payload, ["order", "mall_id"]) ||
    getNestedRecordValue(payload, ["resource", "mall_id"]) ||
    getNestedRecordValue(payload, ["data", "mall_id"]) ||
    getNestedRecordValue(payload, ["event", "mall_id"])
  );
}

export function extractCafe24WebhookEventType(payload: unknown, headersSummary: Record<string, string>): string {
  const fromPayload =
    getNestedRecordValue(payload, ["event_type"]) ||
    getNestedRecordValue(payload, ["event"]) ||
    getNestedRecordValue(payload, ["topic"]) ||
    getNestedRecordValue(payload, ["resource_type"]);

  if (fromPayload) return fromPayload;

  const eventNo =
    asString(getNestedUnknownValue(payload, ["event_no"])) ||
    asString(getNestedUnknownValue(payload, ["resource", "event_no"])) ||
    asString(getNestedUnknownValue(payload, ["data", "event_no"]));

  if (eventNo === "90023") return "order.received";
  if (eventNo === "90025") return "order.updated";

  const headerCandidates = [
    "x-cafe24-event-type",
    "x-cafe24-event",
    "x-cafe24-topic",
    "x-event-type",
    "x-event",
    "x-topic"
  ];
  for (const key of headerCandidates) {
    const value = headersSummary[key];
    if (value && value !== "[masked]") return value;
  }

  return "unknown";
}

export function summarizeCafe24WebhookPayload(payload: unknown): Cafe24WebhookPayloadSummary {
  const sanitized = sanitizeJsonValue(payload);
  const topLevelKeys = isRecord(sanitized) ? Object.keys(sanitized).sort() : [];
  const mallId = extractCafe24WebhookMallId(sanitized);
  const orderId = extractCafe24WebhookOrderId(sanitized);
  const eventType = extractCafe24WebhookEventType(sanitized, {});

  return {
    topLevelKeys,
    mallId,
    orderId,
    eventType
  };
}

export async function createCafe24WebhookEvent(input: {
  payload: unknown;
  headers: Headers;
}): Promise<Cafe24WebhookEventRecord> {
  const headersSummary = summarizeHeaders(input.headers);
  const sanitizedPayload = sanitizeJsonValue(input.payload);
  const mallId = extractCafe24WebhookMallId(sanitizedPayload);
  const orderId = extractCafe24WebhookOrderId(sanitizedPayload);
  const eventType = extractCafe24WebhookEventType(sanitizedPayload, headersSummary);
  const now = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cafe24_webhook_events")
    .insert({
      mall_id: mallId,
      event_type: eventType,
      order_id: orderId,
      payload: sanitizedPayload,
      headers_summary: headersSummary,
      received_at: now,
      processed_status: "received",
      error_message: null,
      created_at: now
    })
    .select("*")
    .single();

  if (error) {
    console.error("cafe24_webhook_event_insert_failed", {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null
    });
    throw new Error("Failed to store Cafe24 webhook event.");
  }

  return data as Cafe24WebhookEventRecord;
}

export async function updateCafe24WebhookEventProcessing(input: {
  id: string;
  processedStatus: Cafe24WebhookProcessedStatus;
  errorMessage?: string | null;
  orderId?: string | null;
}): Promise<Cafe24WebhookEventRecord> {
  const updatePayload: Record<string, unknown> = {
    processed_status: input.processedStatus,
    error_message: input.errorMessage ?? null
  };

  if (input.orderId !== undefined) {
    updatePayload.order_id = input.orderId;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cafe24_webhook_events")
    .update(updatePayload)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    console.error("cafe24_webhook_event_update_failed", {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null
    });
    throw new Error("Failed to update Cafe24 webhook event processing status.");
  }

  return data as Cafe24WebhookEventRecord;
}

export async function listRecentCafe24WebhookEvents(limit = 10): Promise<Cafe24WebhookEventRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cafe24_webhook_events")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("cafe24_webhook_events_load_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to load Cafe24 webhook events.");
  }

  return (data ?? []) as Cafe24WebhookEventRecord[];
}
