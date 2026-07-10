import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type FileStatusChangeLogRecord = {
  id: string;
  file_id: string;
  previous_status: string | null;
  new_status: string;
  memo: string | null;
  admin_user: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

function sanitizeText(value?: string | null, maxLength = 500) {
  if (!value) {
    return null;
  }

  return value.replace(/[\r\n\0]/g, " ").trim().slice(0, maxLength) || null;
}

function sanitizeErrorMessage(message?: string | null) {
  return sanitizeText(message, 300);
}

export async function listFileStatusChangeLogs(
  fileId: string,
  limit = 5
): Promise<FileStatusChangeLogRecord[]> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_status_change_logs")
    .select("*")
    .eq("file_id", trimmedFileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("file_status_change_logs_load_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message)
    });
    return [];
  }

  return (data ?? []) as FileStatusChangeLogRecord[];
}
