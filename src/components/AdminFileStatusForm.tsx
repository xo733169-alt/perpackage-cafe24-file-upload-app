"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILE_STATUS_OPTIONS, getFileStatusLabel } from "@/lib/files/file-status";

type AdminFileStatusFormProps = {
  fileId: string;
  currentStatus: string;
  variant?: "default" | "compact";
};

export function AdminFileStatusForm({ fileId, currentStatus, variant = "default" }: AdminFileStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus || "uploaded_pending");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isCompact = variant === "compact";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const response = await fetch("/api/admin/files/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: fileId,
          status,
          memo
        })
      });
      const result = await response.json().catch(() => null) as { message?: string } | null;

      if (!response.ok) {
        setMessage(result?.message ?? "상태 변경에 실패했습니다.");
        return;
      }

      setMemo("");
      setMessage("상태가 변경되었습니다.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("네트워크 오류로 상태 변경에 실패했습니다.");
    }
  }

  const form = (
    <>
      {!isCompact ? <h3 style={{ marginTop: 0 }}>파일 상태 변경</h3> : null}
      <p style={{ marginTop: 0, marginBottom: isCompact ? 8 : undefined }}>
        현재 상태: <strong>{getFileStatusLabel(currentStatus)}</strong>
      </p>
      <form className={isCompact ? "form form-compact" : "form"} onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor={`file_status_${fileId}`}>상태 선택</label>
          <select
            id={`file_status_${fileId}`}
            name="status"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            {FILE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`file_status_memo_${fileId}`}>메모</label>
          <textarea
            id={`file_status_memo_${fileId}`}
            name="memo"
            onChange={(event) => setMemo(event.target.value)}
            placeholder="선택사항입니다."
            rows={3}
            value={memo}
          />
        </div>
        <button className="button" disabled={isPending} type="submit">
          {isPending ? "변경 중..." : "상태 변경"}
        </button>
      </form>
      {message ? <p style={{ marginBottom: 0 }}>{message}</p> : null}
    </>
  );

  if (isCompact) {
    return <div className="status-form-compact">{form}</div>;
  }

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      {form}
    </div>
  );
}
