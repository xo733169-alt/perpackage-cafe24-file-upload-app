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

export type CreateFileOrderLinkLogInput = {
  fileId: string;
  previousOrderId?: string | null;
  newOrderId: string;
  linkSource: FileOrderLinkSource;
  webhookEventId?: string | null;
  adminUser?: string | null;
  memo?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateFileOrderLinkLogResult = {
  saved: boolean;
  errorMessage: string | null;
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

export async function createFileOrderLinkLog(
  input: CreateFileOrderLinkLogInput
): Promise<CreateFileOrderLinkLogResult> {
  const previousOrderId = sanitizeText(input.previousOrderId, 120);
  const newOrderId = sanitizeText(input.newOrderId, 120);

  if (!input.fileId.trim() || !newOrderId) {
    return {
      saved: false,
      errorMessage: "Missing file_id or order_id."
    };
  }

  if (previousOrderId === newOrderId) {
    return {
      saved: false,
      errorMessage: null
    };
  }

  const payload = {
    file_id: input.fileId.trim(),
    previous_order_id: previousOrderId,
    new_order_id: newOrderId,
    link_source: input.linkSource,
    webhook_event_id: sanitizeText(input.webhookEventId, 120),
    admin_user: sanitizeText(input.adminUser, 120) ?? "admin",
    memo: sanitizeText(input.memo),
    ip_address: sanitizeText(input.ipAddress, 120),
    user_agent: sanitizeText(input.userAgent, 500)
  };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("file_order_link_logs")
      .insert(payload);

    if (error) {
      const errorMessage = sanitizeErrorMessage(error.message);

      console.warn("file_order_link_log_insert_failed", {
        code: error.code ?? null,
        message: errorMessage,
        details: sanitizeErrorMessage(error.details),
        hint: sanitizeErrorMessage(error.hint),
        fileId: input.fileId,
        linkSource: input.linkSource
      });

      return {
        saved: false,
        errorMessage
      };
    }

    return {
      saved: true,
      errorMessage: null
    };
  } catch (error) {
    const errorMessage = sanitizeErrorMessage(error instanceof Error ? error.message : "Unknown order link log error");

    console.warn("file_order_link_log_insert_failed", {
      code: null,
      message: errorMessage,
      details: null,
      hint: null,
      fileId: input.fileId,
      linkSource: input.linkSource
    });

    return {
      saved: false,
      errorMessage
    };
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
