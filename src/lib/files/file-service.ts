import { nanoid } from "nanoid";
import { getFileOrderRpcErrorKind, getFileStatusRpcErrorKind } from "@/lib/files/file-admin-rpc-policy";
import type { FileOrderLinkSource } from "@/lib/files/order-link-log-service";
import { isKnownFileStatus } from "@/lib/files/file-status";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadToNaverObjectStorage } from "@/lib/storage/naver-object-storage";
import type { FileUploadInput, UploadedFileRecord } from "./types";
import { getExtension, validateUploadFile, validateUploadFileMetadata } from "./upload-security";

const STORAGE_PROVIDER = "naver-object-storage";

export type RecentFileOrderLinkFilter = "all" | "linked" | "unlinked";

export type ListRecentFilesFilters = {
  status?: string;
  orderLink?: RecentFileOrderLinkFilter;
};

export class FileOrderLinkConflictError extends Error {
  constructor() {
    super("Uploaded file is already linked to another order.");
    this.name = "FileOrderLinkConflictError";
  }
}

export class FileStatusTransitionError extends Error {
  constructor() {
    super("The requested file status transition is not allowed.");
    this.name = "FileStatusTransitionError";
  }
}

export class FileStatusConcurrentChangeError extends Error {
  constructor() {
    super("The file status changed while the update was being processed.");
    this.name = "FileStatusConcurrentChangeError";
  }
}

type AdminLinkFileOrderRpcRow = {
  changed: boolean;
  file_id: string;
  previous_order_id: string | null;
  current_order_id: string;
  updated_at: string;
};

type AdminUpdateFileStatusRpcRow = {
  changed: boolean;
  file_id: string;
  previous_status: string;
  current_status: string;
  updated_at: string;
};

function getFirstRpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) {
    return (data[0] as T | undefined) ?? null;
  }

  return data && typeof data === "object" ? data as T : null;
}

function sanitizeFilename(filename: string) {
  const normalized = filename.normalize("NFKC").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return normalized || "upload-file";
}

function buildStoragePath(input: {
  mallId?: string | null;
  productNo?: string | null;
  storedFilename: string;
}) {
  const mallId = input.mallId?.trim() || "unknown-mall";
  const productNo = input.productNo?.trim() || "unknown-product";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `cafe24-files/${mallId}/${productNo}/${date}/${input.storedFilename}`;
}

export async function uploadFile(input: FileUploadInput): Promise<UploadedFileRecord> {
  validateUploadFileMetadata(input.file);

  const originalFilename = sanitizeFilename(input.file.name);
  const storedFilename = `${Date.now()}-${nanoid(10)}${getExtension(originalFilename)}`;
  const storagePath = buildStoragePath({
    mallId: input.mallId,
    productNo: input.productNo,
    storedFilename
  });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const validatedFile = validateUploadFile({
    file: input.file,
    buffer
  });
  const uploaded = await uploadToNaverObjectStorage({
    key: storagePath,
    body: buffer,
    contentType: validatedFile.canonicalMimeType
  });
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("files")
    .insert({
      mall_id: input.mallId ?? null,
      shop_no: input.shopNo ?? null,
      product_no: input.productNo ?? null,
      variant_code: input.variantCode ?? null,
      customer_type: input.customerType ?? null,
      customer_identifier: input.customerIdentifier ?? null,
      original_filename: originalFilename,
      stored_filename: storedFilename,
      file_size: input.file.size,
      mime_type: validatedFile.canonicalMimeType,
      storage_provider: STORAGE_PROVIDER,
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      public_preview_url: null,
      secure_download_url: null,
      order_id: null,
      inquiry_id: null,
      status: "uploaded_pending",
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (error) {
    throw new Error("Failed to store uploaded file metadata.");
  }

  return data as UploadedFileRecord;
}

export async function listRecentFiles(limit = 20, filters: ListRecentFilesFilters = {}): Promise<UploadedFileRecord[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("files")
    .select("*");

  if (filters.status && isKnownFileStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }

  if (filters.orderLink === "linked") {
    query = query.not("order_id", "is", null);
  }

  if (filters.orderLink === "unlinked") {
    query = query.is("order_id", null);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("list_recent_files_failed", {
      limit,
      statusFilter: filters.status ?? null,
      orderLinkFilter: filters.orderLink ?? null,
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to load recent uploaded files.");
  }

  console.info("list_recent_files_result", {
    limit,
    statusFilter: filters.status ?? null,
    orderLinkFilter: filters.orderLink ?? null,
    count: data?.length ?? 0
  });

  return (data ?? []) as UploadedFileRecord[];
}

export async function getFileById(fileId: string): Promise<UploadedFileRecord | null> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", trimmedFileId)
    .maybeSingle();

  if (error) {
    console.error("get_file_by_id_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to load uploaded file by file_id.");
  }

  return data ? (data as UploadedFileRecord) : null;
}

export async function listFilesByOrderId(orderId: string): Promise<UploadedFileRecord[]> {
  const trimmedOrderId = orderId.trim();
  if (!trimmedOrderId) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("order_id", trimmedOrderId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("list_files_by_order_id_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to load uploaded files by order_id.");
  }

  return (data ?? []) as UploadedFileRecord[];
}

export async function updateFileOrderId(input: {
  fileId: string;
  orderId: string;
  linkSource: FileOrderLinkSource;
  webhookEventId?: string | null;
  adminUser?: string | null;
  memo?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{
  changed: boolean;
  fileId: string;
  previousOrderId: string | null;
  currentOrderId: string;
  updatedAt: string;
}> {
  const fileId = input.fileId.trim();
  const orderId = input.orderId.trim();

  if (!fileId) {
    throw new Error("file_id is required.");
  }

  if (!orderId) {
    throw new Error("order_id is required.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_link_file_order", {
    p_file_id: fileId,
    p_order_id: orderId,
    p_link_source: input.linkSource,
    p_webhook_event_id: input.webhookEventId ?? null,
    p_admin_user: input.adminUser ?? "admin",
    p_memo: input.memo ?? null,
    p_ip_address: input.ipAddress ?? null,
    p_user_agent: input.userAgent ?? null
  });

  if (error) {
    const errorKind = getFileOrderRpcErrorKind(error.message);
    if (errorKind === "conflict") {
      throw new FileOrderLinkConflictError();
    }

    if (errorKind === "not_found") {
      throw new Error("Uploaded file was not found.");
    }

    console.error("admin_link_file_order_rpc_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to link uploaded file order_id.");
  }

  const result = getFirstRpcRow<AdminLinkFileOrderRpcRow>(data);
  if (!result) {
    throw new Error("Admin order link RPC returned no result.");
  }

  return {
    changed: result.changed,
    fileId: result.file_id,
    previousOrderId: result.previous_order_id,
    currentOrderId: result.current_order_id,
    updatedAt: result.updated_at
  };
}

export async function updateFileStatus(input: {
  fileId: string;
  expectedStatus: string;
  status: string;
  memo?: string | null;
  adminUser?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{
  file: Pick<UploadedFileRecord, "id" | "status" | "updated_at">;
  previousStatus: string;
  changed: boolean;
}> {
  const fileId = input.fileId.trim();
  const expectedStatus = input.expectedStatus.trim();
  const status = input.status.trim();

  if (!fileId) {
    throw new Error("file_id is required.");
  }

  if (!status) {
    throw new Error("status is required.");
  }

  if (!isKnownFileStatus(expectedStatus) || !isKnownFileStatus(status)) {
    throw new Error("Unsupported file status.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_update_file_status", {
    p_file_id: fileId,
    p_expected_status: expectedStatus,
    p_new_status: status,
    p_memo: input.memo ?? null,
    p_admin_user: input.adminUser ?? "admin",
    p_ip_address: input.ipAddress ?? null,
    p_user_agent: input.userAgent ?? null
  });

  if (error) {
    const errorKind = getFileStatusRpcErrorKind(error.message);
    if (errorKind === "transition") {
      throw new FileStatusTransitionError();
    }

    if (errorKind === "conflict") {
      throw new FileStatusConcurrentChangeError();
    }

    if (errorKind === "not_found") {
      throw new Error("Uploaded file was not found.");
    }

    console.error("admin_update_file_status_rpc_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to update uploaded file status.");
  }

  const result = getFirstRpcRow<AdminUpdateFileStatusRpcRow>(data);
  if (!result) {
    throw new Error("Admin file status RPC returned no result.");
  }

  return {
    file: {
      id: result.file_id,
      status: result.current_status,
      updated_at: result.updated_at
    },
    previousStatus: result.previous_status,
    changed: result.changed
  };
}
