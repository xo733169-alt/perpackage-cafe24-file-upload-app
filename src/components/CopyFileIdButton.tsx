"use client";

import { useState } from "react";

type CopyFileIdButtonProps = {
  fileId: string;
};

export function CopyFileIdButton({ fileId }: CopyFileIdButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const shortFileId = fileId.slice(0, 8);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fileId);
      setMessage("file_id가 복사되었습니다.");
    } catch {
      setMessage("file_id 복사에 실패했습니다.");
    }
  }

  return (
    <div className="copy-file-id">
      <code>{shortFileId}</code>
      <button className="button secondary button-small" onClick={handleCopy} type="button">
        복사
      </button>
      {message ? <span className="copy-message">{message}</span> : null}
    </div>
  );
}
