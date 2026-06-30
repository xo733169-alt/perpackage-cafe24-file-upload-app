import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { UploadedFileRecord } from "./types";

export type FileDownloadLogResult = "success" | "failed";

export type FileDownloadLogRecord = {
  id: string;
  file_id: string | null;
  original_filename: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  downloaded_at: string;
  ip_address: string | null;
  user_agent: string | null;
  result: FileDownloadLogResult | string;
  error_message: string | null;
  created_at: string;
};

export type CreateFileDownloadLogInput = {
  file?: UploadedFileRecord | null;
  fileId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  result: FileDownloadLogResult;
  errorMessage?: string | null;
};

function sanitizeErrorMessage(message?: string | null) {
  if (!message) {
    return null;
  }

  return message.replace(/[\r\n\0]/g, " ").slice(0, 300);
}

export async function createFileDownloadLog(input: CreateFileDownloadLogInput) {
  try {
    const file = input.file ?? null;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("file_download_logs")
      .insert({
        file_id: file?.id ?? input.fileId ?? null,
        original_filename: file?.original_filename ?? null,
        storage_bucket: file?.storage_bucket ?? null,
        storage_path: file?.storage_path ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        result: input.result,
        error_message: sanitizeErrorMessage(input.errorMessage)
      });

    if (error) {
      console.error("file_download_log_insert_failed", {
        code: error.code ?? null,
        message: error.message ?? null,
        result: input.result
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("file_download_log_insert_failed", {
      code: null,
      message: error instanceof Error ? error.message : "Unknown download log error",
      result: input.result
    });
    return false;
  }
}

export async function listFileDownloadLogs(fileId: string, limit = 5): Promise<FileDownloadLogRecord[]> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_download_logs")
    .select("*")
    .eq("file_id", trimmedFileId)
    .order("downloaded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("file_download_logs_load_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    return [];
  }

  return (data ?? []) as FileDownloadLogRecord[];
}
