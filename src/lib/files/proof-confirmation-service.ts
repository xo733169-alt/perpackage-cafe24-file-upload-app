import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ProofConfirmationStatus = "requested" | "confirmed" | "rejected" | "canceled" | "skipped";
export type ProofConfirmationStatusFilter = ProofConfirmationStatus | "all";

export type ProofConfirmationRecord = {
  id: string;
  file_id: string;
  order_id: string | null;
  proof_status: ProofConfirmationStatus;
  request_message: string | null;
  selected_items: string[] | null;
  extra_memo: string | null;
  customer_response: string | null;
  reject_reason: string | null;
  requested_by: string | null;
  requested_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  response_channel: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProofConfirmationRequestInput = {
  fileId: string;
  orderId?: string | null;
  requestMessage: string;
  selectedItems?: string[] | null;
  extraMemo?: string | null;
  requestedBy?: string | null;
};

export type UpdateProofConfirmationStatusInput = {
  confirmationId: string;
  proofStatus: Exclude<ProofConfirmationStatus, "requested" | "skipped">;
  customerResponse?: string | null;
  rejectReason?: string | null;
  responseChannel?: string | null;
  confirmedBy?: string | null;
};

export type ListProofConfirmationsInput = {
  proofStatus?: ProofConfirmationStatusFilter;
  fileId?: string;
  orderId?: string;
  limit?: number;
};

const PROOF_STATUS_LABELS: Record<ProofConfirmationStatus, string> = {
  requested: "교정확인 요청",
  confirmed: "고객 확인 완료",
  rejected: "고객 수정 요청",
  canceled: "요청 취소",
  skipped: "교정확인 생략"
};

const ALLOWED_UPDATE_STATUSES = new Set<UpdateProofConfirmationStatusInput["proofStatus"]>([
  "confirmed",
  "rejected",
  "canceled"
]);

const ALLOWED_FILTER_STATUSES = new Set<ProofConfirmationStatusFilter>([
  "all",
  "requested",
  "confirmed",
  "rejected",
  "canceled",
  "skipped"
]);

function sanitizeText(value?: string | null, maxLength = 1000) {
  if (!value) {
    return null;
  }

  return value.replace(/\0/g, "").trim().slice(0, maxLength) || null;
}

function sanitizeTextList(values?: string[] | null) {
  if (!values?.length) {
    return null;
  }

  const cleaned = values
    .map((value) => sanitizeText(value, 300))
    .filter((value): value is string => Boolean(value));

  return cleaned.length ? cleaned : null;
}

function sanitizeErrorMessage(message?: string | null) {
  return sanitizeText(message, 300);
}

export function getProofStatusLabel(status: string | null | undefined) {
  return PROOF_STATUS_LABELS[status as ProofConfirmationStatus] ?? status ?? "-";
}

export function getProofStatusFilter(value: string | null | undefined): ProofConfirmationStatusFilter {
  return ALLOWED_FILTER_STATUSES.has(value as ProofConfirmationStatusFilter)
    ? (value as ProofConfirmationStatusFilter)
    : "all";
}

export async function createProofConfirmationRequest(
  input: CreateProofConfirmationRequestInput
): Promise<ProofConfirmationRecord> {
  const fileId = input.fileId.trim();
  const requestMessage = sanitizeText(input.requestMessage, 5000);

  if (!fileId) {
    throw new Error("file_id is required.");
  }

  if (!requestMessage) {
    throw new Error("request_message is required.");
  }

  const now = new Date().toISOString();
  const payload = {
    file_id: fileId,
    order_id: sanitizeText(input.orderId, 120),
    proof_status: "requested" satisfies ProofConfirmationStatus,
    request_message: requestMessage,
    selected_items: sanitizeTextList(input.selectedItems),
    extra_memo: sanitizeText(input.extraMemo, 1000),
    customer_response: null,
    reject_reason: null,
    requested_by: sanitizeText(input.requestedBy, 120) ?? "admin",
    requested_at: now,
    confirmed_by: null,
    confirmed_at: null,
    response_channel: null,
    updated_at: now
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_proof_confirmations")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("proof_confirmation_request_insert_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint),
      fileId
    });
    throw new Error("Failed to save proof confirmation request.");
  }

  return data as ProofConfirmationRecord;
}

export async function listProofConfirmationsByFileId(
  fileId: string,
  limit = 10
): Promise<ProofConfirmationRecord[]> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_proof_confirmations")
    .select("*")
    .eq("file_id", trimmedFileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("proof_confirmations_load_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      fileId: trimmedFileId
    });
    return [];
  }

  return (data ?? []) as ProofConfirmationRecord[];
}

export async function listProofConfirmations(
  input: ListProofConfirmationsInput = {}
): Promise<ProofConfirmationRecord[]> {
  const proofStatus = getProofStatusFilter(input.proofStatus ?? "all");
  const fileId = sanitizeText(input.fileId, 120);
  const orderId = sanitizeText(input.orderId, 120);
  const limit = Math.max(1, Math.min(input.limit ?? 10, 50));
  const fetchLimit = fileId ? Math.max(limit, 100) : limit;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("file_proof_confirmations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (proofStatus !== "all") {
    query = query.eq("proof_status", proofStatus);
  }

  if (orderId) {
    query = query.ilike("order_id", `%${orderId}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("proof_confirmations_admin_list_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint),
      proofStatus,
      hasFileIdFilter: Boolean(fileId),
      hasOrderIdFilter: Boolean(orderId)
    });
    return [];
  }

  const records = (data ?? []) as ProofConfirmationRecord[];
  const filteredRecords = fileId
    ? records.filter((record) => record.file_id.toLowerCase().includes(fileId.toLowerCase()))
    : records;

  return filteredRecords.slice(0, limit);
}

export async function updateProofConfirmationStatus(
  input: UpdateProofConfirmationStatusInput
): Promise<ProofConfirmationRecord> {
  const confirmationId = input.confirmationId.trim();
  const proofStatus = input.proofStatus.trim() as UpdateProofConfirmationStatusInput["proofStatus"];

  if (!confirmationId) {
    throw new Error("proof_confirmation_id is required.");
  }

  if (!ALLOWED_UPDATE_STATUSES.has(proofStatus)) {
    throw new Error("Unsupported proof confirmation status.");
  }

  const now = new Date().toISOString();
  const payload = {
    proof_status: proofStatus,
    customer_response: sanitizeText(input.customerResponse, 1000),
    reject_reason: sanitizeText(input.rejectReason, 1000),
    response_channel: sanitizeText(input.responseChannel, 120),
    confirmed_by: sanitizeText(input.confirmedBy, 120) ?? "admin",
    confirmed_at: now,
    updated_at: now
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_proof_confirmations")
    .update(payload)
    .eq("id", confirmationId)
    .eq("proof_status", "requested")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("proof_confirmation_status_update_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint),
      confirmationId,
      proofStatus
    });
    throw new Error("Failed to update proof confirmation status.");
  }

  if (!data) {
    throw new Error("Proof confirmation request was not found or already processed.");
  }

  return data as ProofConfirmationRecord;
}
