import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type CreateFileReviewLogInput = {
  fileId: string;
  previousStatus: string | null;
  newStatus: string;
  memo?: string | null;
  adminUser?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateFileReviewLogResult = {
  saved: boolean;
  errorMessage: string | null;
};

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

export async function createFileReviewLog(input: CreateFileReviewLogInput): Promise<CreateFileReviewLogResult> {
  const payload = {
    file_id: input.fileId,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    memo: sanitizeText(input.memo),
    admin_user: sanitizeText(input.adminUser, 120) ?? "admin",
    ip_address: sanitizeText(input.ipAddress, 120),
    user_agent: sanitizeText(input.userAgent, 500)
  };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("file_status_change_logs")
      .insert(payload);

    if (error) {
      const errorMessage = sanitizeErrorMessage(error.message);

      console.warn("file_status_change_log_insert_failed", {
        code: error.code ?? null,
        message: errorMessage,
        details: sanitizeErrorMessage(error.details),
        hint: sanitizeErrorMessage(error.hint),
        fileId: input.fileId,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus
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
    const errorMessage = sanitizeErrorMessage(error instanceof Error ? error.message : "Unknown review log error");

    console.warn("file_status_change_log_insert_failed", {
      code: null,
      message: errorMessage,
      details: null,
      hint: null,
      fileId: input.fileId,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus
    });

    return {
      saved: false,
      errorMessage
    };
  }
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
