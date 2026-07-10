export type FileStatusRpcErrorKind = "not_found" | "conflict" | "transition" | "unknown";
export type FileOrderRpcErrorKind = "not_found" | "conflict" | "unknown";

function includesCode(message: string | null | undefined, code: string) {
  return (message ?? "").toLowerCase().includes(code);
}

export function getFileStatusRpcErrorKind(message: string | null | undefined): FileStatusRpcErrorKind {
  if (includesCode(message, "file_status_file_not_found")) return "not_found";
  if (includesCode(message, "file_status_conflict")) return "conflict";
  if (includesCode(message, "file_status_transition_not_allowed")) return "transition";
  return "unknown";
}

export function getFileOrderRpcErrorKind(message: string | null | undefined): FileOrderRpcErrorKind {
  if (includesCode(message, "file_order_file_not_found")) return "not_found";
  if (includesCode(message, "file_order_conflict")) return "conflict";
  return "unknown";
}
