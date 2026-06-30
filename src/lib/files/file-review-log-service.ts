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

function sanitizeText(value?: string | null, maxLength = 500) {
  if (!value) {
    return null;
  }

  return value.replace(/[\r\n\0]/g, " ").trim().slice(0, maxLength) || null;
}

export async function createFileReviewLog(input: CreateFileReviewLogInput) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("file_review_logs")
      .insert({
        file_id: input.fileId,
        previous_status: input.previousStatus,
        new_status: input.newStatus,
        memo: sanitizeText(input.memo),
        admin_user: sanitizeText(input.adminUser, 120) ?? "admin",
        ip_address: sanitizeText(input.ipAddress, 120),
        user_agent: sanitizeText(input.userAgent, 500)
      });

    if (error) {
      console.warn("file_review_log_insert_failed", {
        code: error.code ?? null,
        message: error.message ?? null,
        fileId: input.fileId,
        newStatus: input.newStatus
      });
      return false;
    }

    return true;
  } catch (error) {
    console.warn("file_review_log_insert_failed", {
      code: null,
      message: error instanceof Error ? error.message : "Unknown review log error",
      fileId: input.fileId,
      newStatus: input.newStatus
    });
    return false;
  }
}
