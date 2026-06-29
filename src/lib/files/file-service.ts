import { nanoid } from "nanoid";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadToNaverObjectStorage } from "@/lib/storage/naver-object-storage";
import type { FileUploadInput, UploadedFileRecord } from "./types";

const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = 10;
const STORAGE_PROVIDER = "naver-object-storage";

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
    throw new Error("파일이 비어 있습니다.");
  }

  if (file.size > getUploadLimitBytes()) {
    throw new Error("파일 용량이 현재 테스트 제한을 초과했습니다.");
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
    throw new Error("파일 메타데이터 저장에 실패했습니다.");
  }

  return data as UploadedFileRecord;
}

export async function listRecentFiles(limit = 20): Promise<UploadedFileRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("최근 업로드 파일 목록을 불러오지 못했습니다.");
  return (data ?? []) as UploadedFileRecord[];
}
