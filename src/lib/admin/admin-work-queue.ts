export const NORMAL_WEBHOOK_STATUSES = new Set(["auto_linked", "already_linked"]);

export function isWebhookAttentionStatus(status: string | null | undefined) {
  return !NORMAL_WEBHOOK_STATUSES.has(status?.trim() ?? "");
}

export function isReuploadReadyForReview(input: {
  status: string | null | undefined;
  new_file_id: string | null | undefined;
  new_file_status: string | null | undefined;
}) {
  return input.status === "uploaded" &&
    Boolean(input.new_file_id?.trim()) &&
    (input.new_file_status === "uploaded_pending" || input.new_file_status === "reviewing");
}

export function isUnlinkedFileWorkItem(input: {
  order_id: string | null | undefined;
  status: string | null | undefined;
}) {
  const status = input.status?.trim() ?? "";
  return !input.order_id?.trim() && status !== "archived" && status !== "replaced";
}

export function isPendingReviewFileWorkItem(input: {
  order_id: string | null | undefined;
  status: string | null | undefined;
}) {
  return Boolean(input.order_id?.trim()) && input.status === "uploaded_pending";
}
