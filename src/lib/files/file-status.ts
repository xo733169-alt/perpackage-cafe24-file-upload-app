export const FILE_STATUS_OPTIONS = [
  { value: "uploaded_pending", label: "업로드됨 / 확인 전" },
  { value: "reviewing", label: "파일 확인 중" },
  { value: "approved", label: "파일 확인 완료" },
  { value: "need_reupload", label: "재업로드 요청" },
  { value: "replaced", label: "새 파일로 교체됨" },
  { value: "archived", label: "보관 처리" }
] as const;

export type FileStatusValue = (typeof FILE_STATUS_OPTIONS)[number]["value"];

const FILE_STATUS_LABELS = new Map<string, string>(
  FILE_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

export function getFileStatusLabel(status?: string | null) {
  if (!status) {
    return "-";
  }

  return FILE_STATUS_LABELS.get(status) ?? status;
}

export function isKnownFileStatus(status: string): status is FileStatusValue {
  return FILE_STATUS_LABELS.has(status);
}
