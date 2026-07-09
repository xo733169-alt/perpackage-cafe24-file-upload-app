import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { getFileById } from "@/lib/files/file-service";
import type { UploadedFileRecord } from "@/lib/files/types";
import { getExtension, validateUploadFile } from "@/lib/files/upload-security";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadToNaverObjectStorage } from "@/lib/storage/naver-object-storage";

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
  public_id: string | null;
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

export type ReuploadRequestLookupResult =
  | {
      state: "valid";
      request: FileReuploadRequestRecord;
      originalFile: UploadedFileRecord;
    }
  | {
      state: "missing_token" | "invalid" | "expired" | "used" | "canceled" | "failed";
      request?: FileReuploadRequestRecord;
      originalFile?: UploadedFileRecord | null;
    };

export type CompleteReuploadRequestInput = {
  rawToken: string;
  file: File;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CompleteReuploadRequestByPublicIdInput = {
  publicId: string;
  file: File;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CompleteReuploadRequestResult = {
  request: FileReuploadRequestRecord;
  file: Pick<UploadedFileRecord, "id" | "original_filename" | "file_size" | "mime_type" | "status" | "created_at">;
};

const REUPLOAD_REQUEST_SELECT = [
  "id",
  "public_id",
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

const STORAGE_PROVIDER = "naver-object-storage";
const PUBLIC_REUPLOAD_ID_LENGTH = 32;
const PUBLIC_REUPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

function sanitizeText(value?: string | null, maxLength = 1000) {
  if (!value) {
    return null;
  }

  return value.replace(/\0/g, "").trim().slice(0, maxLength) || null;
}

function sanitizeErrorMessage(message?: string | null) {
  return sanitizeText(message, 300);
}

function sanitizeFilename(filename: string) {
  const normalized = filename.normalize("NFKC").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return normalized || "reupload-file";
}

function buildReuploadStoragePath(input: {
  mallId?: string | null;
  productNo?: string | null;
  requestId: string;
  storedFilename: string;
}) {
  const mallId = input.mallId?.trim() || "unknown-mall";
  const productNo = input.productNo?.trim() || "unknown-product";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `cafe24-reuploads/${mallId}/${productNo}/${date}/${input.requestId}/${input.storedFilename}`;
}

export function getFileReuploadRequestStatusLabel(status: string | null | undefined) {
  return REUPLOAD_STATUS_LABELS[status as FileReuploadRequestStatus] ?? status ?? "-";
}

export function createRawReuploadToken() {
  return randomBytes(32).toString("base64url");
}

export function createPublicReuploadId() {
  return nanoid(PUBLIC_REUPLOAD_ID_LENGTH);
}

export function hashReuploadToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function getReuploadRequestByTokenHash(tokenHash: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_reupload_requests")
    .select(REUPLOAD_REQUEST_SELECT)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("file_reupload_request_token_lookup_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint)
    });
    throw new Error("Failed to load file reupload request.");
  }

  return data ? (data as unknown as FileReuploadRequestRecord) : null;
}

async function getReuploadRequestByPublicId(publicId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_reupload_requests")
    .select(REUPLOAD_REQUEST_SELECT)
    .eq("public_id", publicId)
    .maybeSingle();

  if (error) {
    console.error("file_reupload_request_public_id_lookup_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint)
    });
    throw new Error("Failed to load file reupload request.");
  }

  return data ? (data as unknown as FileReuploadRequestRecord) : null;
}

function getRequestUnavailableState(request: FileReuploadRequestRecord): Exclude<ReuploadRequestLookupResult["state"], "valid" | "missing_token"> | null {
  if (request.status === "canceled") {
    return "canceled";
  }

  if (request.status === "failed") {
    return "failed";
  }

  if (
    request.new_file_id ||
    request.used_at ||
    request.status === "uploaded" ||
    request.status === "reviewing" ||
    request.status === "completed"
  ) {
    return "used";
  }

  if (new Date(request.expires_at).getTime() <= Date.now() || request.status === "expired") {
    return "expired";
  }

  if (request.status !== "requested") {
    return "invalid";
  }

  return null;
}

export async function lookupReuploadRequestByRawToken(rawToken?: string | null): Promise<ReuploadRequestLookupResult> {
  const token = rawToken?.trim();
  if (!token) {
    return { state: "missing_token" };
  }

  const request = await getReuploadRequestByTokenHash(hashReuploadToken(token));
  if (!request) {
    return { state: "invalid" };
  }

  const unavailableState = getRequestUnavailableState(request);
  if (unavailableState) {
    return { state: unavailableState, request };
  }

  const originalFile = await getFileById(request.original_file_id);
  if (!originalFile) {
    return { state: "invalid", request, originalFile };
  }

  return {
    state: "valid",
    request,
    originalFile
  };
}

export async function lookupReuploadRequestByPublicId(publicId?: string | null): Promise<ReuploadRequestLookupResult> {
  const id = publicId?.trim();
  if (!id || !PUBLIC_REUPLOAD_ID_PATTERN.test(id)) {
    return { state: "invalid" };
  }

  const request = await getReuploadRequestByPublicId(id);
  if (!request) {
    return { state: "invalid" };
  }

  const unavailableState = getRequestUnavailableState(request);
  if (unavailableState) {
    return { state: unavailableState, request };
  }

  const originalFile = await getFileById(request.original_file_id);
  if (!originalFile) {
    return { state: "invalid", request, originalFile };
  }

  return {
    state: "valid",
    request,
    originalFile
  };
}

async function createReuploadedFile(input: {
  request: FileReuploadRequestRecord;
  originalFile: UploadedFileRecord;
  file: File;
}) {
  const originalFilename = sanitizeFilename(input.file.name);
  const storedFilename = `${Date.now()}-${nanoid(10)}${getExtension(originalFilename)}`;
  const storagePath = buildReuploadStoragePath({
    mallId: input.originalFile.mall_id,
    productNo: input.originalFile.product_no,
    requestId: input.request.id,
    storedFilename
  });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  validateUploadFile({
    file: input.file,
    buffer
  });
  const uploaded = await uploadToNaverObjectStorage({
    key: storagePath,
    body: buffer,
    contentType: input.file.type || "application/octet-stream"
  });
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .insert({
      mall_id: input.originalFile.mall_id,
      shop_no: input.originalFile.shop_no,
      product_no: input.originalFile.product_no,
      variant_code: input.originalFile.variant_code,
      customer_type: "cafe24-reupload",
      customer_identifier: input.originalFile.customer_identifier,
      original_filename: originalFilename,
      stored_filename: storedFilename,
      file_size: input.file.size,
      mime_type: input.file.type || "application/octet-stream",
      storage_provider: STORAGE_PROVIDER,
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      public_preview_url: null,
      secure_download_url: null,
      order_id: input.request.order_id,
      inquiry_id: input.originalFile.inquiry_id,
      status: "uploaded_pending",
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();

  if (error) {
    console.error("file_reupload_file_insert_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint),
      requestId: input.request.id,
      originalFileId: input.originalFile.id
    });
    throw new Error("재업로드 파일 정보를 저장하지 못했습니다.");
  }

  return data as UploadedFileRecord;
}

async function markReuploadAttemptFailed(input: {
  request: FileReuploadRequestRecord;
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("file_reupload_requests")
    .update({
      upload_attempt_count: (input.request.upload_attempt_count ?? 0) + 1,
      last_error_message: sanitizeErrorMessage(input.message),
      customer_ip: sanitizeText(input.ipAddress, 120),
      customer_user_agent: sanitizeText(input.userAgent, 500),
      updated_at: new Date().toISOString()
    })
    .eq("id", input.request.id);

  if (error) {
    console.warn("file_reupload_request_failed_attempt_update_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      details: sanitizeErrorMessage(error.details),
      hint: sanitizeErrorMessage(error.hint),
      requestId: input.request.id
    });
  }
}

export async function completeFileReuploadRequest(input: CompleteReuploadRequestInput): Promise<CompleteReuploadRequestResult> {
  const lookup = await lookupReuploadRequestByRawToken(input.rawToken);
  if (lookup.state !== "valid") {
    throw new Error("유효하지 않거나 사용할 수 없는 재업로드 링크입니다.");
  }

  try {
    const uploadedFile = await createReuploadedFile({
      request: lookup.request,
      originalFile: lookup.originalFile,
      file: input.file
    });

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("file_reupload_requests")
      .update({
        new_file_id: uploadedFile.id,
        status: "uploaded" satisfies FileReuploadRequestStatus,
        used_at: now,
        updated_at: now,
        customer_ip: sanitizeText(input.ipAddress, 120),
        customer_user_agent: sanitizeText(input.userAgent, 500),
        upload_attempt_count: (lookup.request.upload_attempt_count ?? 0) + 1,
        last_error_message: null
      })
      .eq("id", lookup.request.id)
      .eq("status", "requested")
      .is("new_file_id", null)
      .is("used_at", null)
      .select(REUPLOAD_REQUEST_SELECT)
      .maybeSingle();

    if (error) {
      console.error("file_reupload_request_complete_failed", {
        code: error.code ?? null,
        message: sanitizeErrorMessage(error.message),
        details: sanitizeErrorMessage(error.details),
        hint: sanitizeErrorMessage(error.hint),
        requestId: lookup.request.id
      });
      throw new Error("재업로드 요청 상태를 갱신하지 못했습니다.");
    }

    if (!data) {
      throw new Error("이미 처리된 재업로드 요청입니다.");
    }

    return {
      request: data as unknown as FileReuploadRequestRecord,
      file: {
        id: uploadedFile.id,
        original_filename: uploadedFile.original_filename,
        file_size: uploadedFile.file_size,
        mime_type: uploadedFile.mime_type,
        status: uploadedFile.status,
        created_at: uploadedFile.created_at
      }
    };
  } catch (error) {
    await markReuploadAttemptFailed({
      request: lookup.request,
      message: error instanceof Error ? error.message : "Unknown reupload error",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
    throw error;
  }
}

export async function completeFileReuploadRequestByPublicId(
  input: CompleteReuploadRequestByPublicIdInput
): Promise<CompleteReuploadRequestResult> {
  const lookup = await lookupReuploadRequestByPublicId(input.publicId);
  if (lookup.state !== "valid") {
    throw new Error("?좏슚?섏? ?딄굅???ъ슜?????녿뒗 ?ъ뾽濡쒕뱶 留곹겕?낅땲??");
  }

  try {
    const uploadedFile = await createReuploadedFile({
      request: lookup.request,
      originalFile: lookup.originalFile,
      file: input.file
    });

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("file_reupload_requests")
      .update({
        new_file_id: uploadedFile.id,
        status: "uploaded" satisfies FileReuploadRequestStatus,
        used_at: now,
        updated_at: now,
        customer_ip: sanitizeText(input.ipAddress, 120),
        customer_user_agent: sanitizeText(input.userAgent, 500),
        upload_attempt_count: (lookup.request.upload_attempt_count ?? 0) + 1,
        last_error_message: null
      })
      .eq("id", lookup.request.id)
      .eq("status", "requested")
      .is("new_file_id", null)
      .is("used_at", null)
      .select(REUPLOAD_REQUEST_SELECT)
      .maybeSingle();

    if (error) {
      console.error("file_reupload_request_complete_failed", {
        code: error.code ?? null,
        message: sanitizeErrorMessage(error.message),
        details: sanitizeErrorMessage(error.details),
        hint: sanitizeErrorMessage(error.hint),
        requestId: lookup.request.id
      });
      throw new Error("?ъ뾽濡쒕뱶 ?붿껌 ?곹깭瑜?媛깆떊?섏? 紐삵뻽?듬땲??");
    }

    if (!data) {
      throw new Error("?대? 泥섎━???ъ뾽濡쒕뱶 ?붿껌?낅땲??");
    }

    return {
      request: data as unknown as FileReuploadRequestRecord,
      file: {
        id: uploadedFile.id,
        original_filename: uploadedFile.original_filename,
        file_size: uploadedFile.file_size,
        mime_type: uploadedFile.mime_type,
        status: uploadedFile.status,
        created_at: uploadedFile.created_at
      }
    };
  } catch (error) {
    await markReuploadAttemptFailed({
      request: lookup.request,
      message: error instanceof Error ? error.message : "Unknown reupload error",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
    throw error;
  }
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
  const publicId = createPublicReuploadId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const payload = {
    public_id: publicId,
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

export async function listFileReuploadRequestsByNewFileId(
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
    .eq("new_file_id", trimmedFileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("file_reupload_source_requests_load_failed", {
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
