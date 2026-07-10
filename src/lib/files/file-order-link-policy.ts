export type FileOrderLinkDecision = "link" | "same" | "conflict";

export function getFileOrderLinkDecision(
  currentOrderId?: string | null,
  requestedOrderId?: string | null
): FileOrderLinkDecision {
  const current = currentOrderId?.trim() ?? "";
  const requested = requestedOrderId?.trim() ?? "";

  if (current && current === requested) {
    return "same";
  }

  return current ? "conflict" : "link";
}
