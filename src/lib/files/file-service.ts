import { nanoid } from "nanoid";
import { isKnownFileStatus } from "@/lib/files/file-status";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadToNaverObjectStorage } from "@/lib/storage/naver-object-storage";
import type { FileUploadInput, UploadedFileRecord } from "./types";

const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = 10;
const STORAGE_PROVIDER = "naver-object-storage";

export type RecentFileOrderLinkFilter = "all" | "linked" | "unlinked";

export type ListRecentFilesFilters = {
  status?: string;
  orderLink?: RecentFileOrderLinkFilter;
};

function sanitizeFilename(filename: string) {
  const normalized = filename.normalize("NFKC").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return normalized || "upload-file";
}

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");
  if (index === -1) return "";
  return filename.slice(index).toLowerCase();
}

function getUploadLimitBytes() {
  const mb = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? DEFAULT_UPLOAD_MAX_FILE_SIZE_MB);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_UPLOAD_MAX_FILE_SIZE_MB;
  return safeMb * 1024 * 1024;
}

function assertAllowedFile(file: File) {
  if (file.size <= 0) {
    throw new Error("File is empty.");
  }

  if (file.size > getUploadLimitBytes()) {
    throw new Error("File size exceeds the current upload limit.");
  }
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
  assertAllowedFile(input.file);

  const originalFilename = sanitizeFilename(input.file.name);
  const storedFilename = `${Date.now()}-${nanoid(10)}${getExtension(originalFilename)}`;
  const storagePath = buildStoragePath({
    mallId: input.mallId,
    productNo: input.productNo,
    storedFilename
  });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const uploaded = await uploadToNaverObjectStorage({
    key: storagePath,
    body: buffer,
    contentType: input.file.type || "application/octet-stream"
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
      mime_type: input.file.type || "application/octet-stream",
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
}): Promise<UploadedFileRecord> {
  const fileId = input.fileId.trim();
  const orderId = input.orderId.trim();

  if (!fileId) {
    throw new Error("file_id is required.");
  }

  if (!orderId) {
    throw new Error("order_id is required.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .update({
      order_id: orderId,
      updated_at: new Date().toISOString()
    })
    .eq("id", fileId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("update_file_order_id_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to update uploaded file order_id.");
  }

  if (!data) {
    throw new Error("Uploaded file was not found.");
  }

  return data as UploadedFileRecord;
}

export async function updateFileStatus(input: {
  fileId: string;
  status: string;
}): Promise<{ file: UploadedFileRecord; previousStatus: string | null }> {
  const fileId = input.fileId.trim();
  const status = input.status.trim();

  if (!fileId) {
    throw new Error("file_id is required.");
  }

  if (!status) {
    throw new Error("status is required.");
  }

  if (!isKnownFileStatus(status)) {
    throw new Error("Unsupported file status.");
  }

  const previousFile = await getFileById(fileId);
  if (!previousFile) {
    throw new Error("Uploaded file was not found.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", fileId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("update_file_status_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    throw new Error("Failed to update uploaded file status.");
  }

  if (!data) {
    throw new Error("Uploaded file was not found.");
  }

  return {
    file: data as UploadedFileRecord,
    previousStatus: previousFile.status ?? null
  };
}
