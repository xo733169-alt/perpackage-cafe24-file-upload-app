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
      .from("file_review_logs")
      .insert(payload);

    if (error) {
      const errorMessage = sanitizeErrorMessage(error.message);

      console.warn("file_review_log_insert_failed", {
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

    console.warn("file_review_log_insert_failed", {
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
