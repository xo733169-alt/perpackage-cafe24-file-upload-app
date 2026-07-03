import { createHash, randomBytes } from "crypto";
import { getFileById } from "@/lib/files/file-service";
import type { UploadedFileRecord } from "@/lib/files/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type FileReuploadRequestStatus =
  | "requested"
  | "uploaded"
  | "reviewing"
  | "completed"
  | "expired"
  | "canceled"
  | "failed";

export type FileReuploadRequestRecord = {
  id: string;
  original_file_id: string;
  new_file_id: string | null;
  order_id: string | null;
  reason: string | null;
  customer_message: string | null;
  status: FileReuploadRequestStatus;
  expires_at: string;
  used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer_ip: string | null;
  customer_user_agent: string | null;
  upload_attempt_count: number;
  last_error_message: string | null;
};

export type CreateFileReuploadRequestInput = {
  originalFileId: string;
  reason?: string | null;
  customerMessage?: string | null;
  createdBy?: string | null;
};

const REUPLOAD_REQUEST_SELECT = [
  "id",
  "original_file_id",
  "new_file_id",
  "order_id",
  "reason",
  "customer_message",
  "status",
  "expires_at",
  "used_at",
  "created_by",
  "created_at",
  "updated_at",
  "customer_ip",
  "customer_user_agent",
  "upload_attempt_count",
  "last_error_message"
].join(", ");

const REUPLOAD_STATUS_LABELS: Record<FileReuploadRequestStatus, string> = {
  requested: "재업로드 요청",
  uploaded: "고객 업로드 완료",
  reviewing: "파일 확인 중",
  completed: "처리 완료",
  expired: "만료됨",
  canceled: "요청 취소",
  failed: "처리 실패"
};

function sanitizeText(value?: string | null, maxLength = 1000) {
  if (!value) {
    return null;
  }

  return value.replace(/\0/g, "").trim().slice(0, maxLength) || null;
}

function sanitizeErrorMessage(message?: string | null) {
  return sanitizeText(message, 300);
}

export function getFileReuploadRequestStatusLabel(status: string | null | undefined) {
  return REUPLOAD_STATUS_LABELS[status as FileReuploadRequestStatus] ?? status ?? "-";
}

export function createRawReuploadToken() {
  return randomBytes(32).toString("base64url");
}

export function hashReuploadToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildReuploadRequestMessage(input: {
  orderId: string | null;
  originalFilename: string;
  reason: string | null;
  reuploadUrl: string;
  customerMessage?: string | null;
}) {
  const lines = [
    "안녕하세요. 페르패키지입니다.",
    "",
    "업로드해주신 인쇄 파일 확인 중 수정 파일 재업로드가 필요하여 안내드립니다.",
    "",
    `주문번호: ${input.orderId || "미연결"}`,
    `기존 파일명: ${input.originalFilename}`,
    `재업로드 요청 사유: ${input.reason || "별도 안내"}`,
    "",
    "아래 링크에서 수정된 인쇄 파일을 다시 업로드해 주세요.",
    "",
    input.reuploadUrl
  ];

  const customerMessage = sanitizeText(input.customerMessage, 1000);
  if (customerMessage) {
    lines.push("", customerMessage);
  }

  lines.push(
    "",
    "파일은 1개만 업로드 가능합니다.",
    "여러 파일을 전달해야 하는 경우 AI, PDF, 이미지, 칼선 파일 등을 하나의 ZIP 파일로 압축해 업로드해 주세요.",
    "",
    "업로드 후 말씀 주시면 빠르게 확인하겠습니다.",
    "",
    "감사합니다."
  );

  return lines.join("\n");
}

export async function createFileReuploadRequest(input: CreateFileReuploadRequestInput): Promise<{
  file: UploadedFileRecord;
  rawToken: string;
  request: FileReuploadRequestRecord;
}> {
  const originalFileId = input.originalFileId.trim();
  if (!originalFileId) {
    throw new Error("file_id is required.");
  }

  const file = await getFileById(originalFileId);
  if (!file) {
    throw new Error("Uploaded file was not found.");
  }

  const rawToken = createRawReuploadToken();
  const tokenHash = hashReuploadToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const payload = {
    original_file_id: file.id,
    new_file_id: null,
    order_id: sanitizeText(file.order_id, 120),
    token_hash: tokenHash,
    reason: sanitizeText(input.reason, 1000),
    customer_message: sanitizeText(input.customerMessage, 2000),
    status: "requested" satisfies FileReuploadRequestStatus,
    expires_at: expiresAt,
    used_at: null,
    created_by: sanitizeText(input.createdBy, 120) ?? "admin",
    updated_at: nowIso,
    customer_ip: null,
    customer_user_agent: null,
    upload_attempt_count: 0,
    last_error_message: null
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_reupload_requests")
    .insert(payload)
    .select(REUPLOAD_REQUEST_SELECT)
    .single();

  if (error) {
    console.error("file_reupload_request_insert_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint),
      fileId: file.id
    });
    throw new Error("Failed to create file reupload request.");
  }

  return {
    file,
    rawToken,
    request: data as unknown as FileReuploadRequestRecord
  };
}

export async function listFileReuploadRequestsByOriginalFileId(
  fileId: string,
  limit = 10
): Promise<FileReuploadRequestRecord[]> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_reupload_requests")
    .select(REUPLOAD_REQUEST_SELECT)
    .eq("original_file_id", trimmedFileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("file_reupload_requests_load_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint),
      fileId: trimmedFileId
    });
    return [];
  }

  return (data ?? []) as unknown as FileReuploadRequestRecord[];
}
