import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type FileOrderLinkSource = "manual" | "cafe24_order_lookup" | "webhook";

export type FileOrderLinkLogRecord = {
  id: string;
  file_id: string;
  previous_order_id: string | null;
  new_order_id: string;
  link_source: FileOrderLinkSource;
  webhook_event_id: string | null;
  admin_user: string | null;
  memo: string | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
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

export function getFileOrderLinkSourceLabel(source: string | null | undefined) {
  switch (source) {
    case "manual":
      return "수동 연결";
    case "cafe24_order_lookup":
      return "Cafe24 주문 조회 연결";
    case "webhook":
      return "Webhook 자동 연결";
    default:
      return source || "-";
  }
}

export async function listFileOrderLinkLogs(fileId: string, limit = 5): Promise<FileOrderLinkLogRecord[]> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_order_link_logs")
    .select("*")
    .eq("file_id", trimmedFileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("file_order_link_logs_load_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message)
    });
    return [];
  }

  return (data ?? []) as FileOrderLinkLogRecord[];
}
