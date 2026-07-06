"use client";

import { FormEvent, useState } from "react";

type FileStatusSuccessResponse = {
  success: true;
  file_id: string;
  file_name: string;
  order_id: string;
  status: string;
  status_label: string;
  customer_message: string;
  uploaded_at: string;
  reupload_required: boolean;
  reupload_status: string | null;
  reupload_status_label: string | null;
  reupload_message: string | null;
  reupload_available: boolean;
  reupload_url: string | null;
};

type FileStatusErrorResponse = {
  success: false;
  error_code: string;
  error_message: string;
};

type FileStatusResponse = FileStatusSuccessResponse | FileStatusErrorResponse;

const EMPTY_INPUT_MESSAGE = "주문번호와 업로드 파일 ID를 모두 입력해 주세요.";
const NETWORK_ERROR_MESSAGE = "네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

export function FileStatusLookupForm() {
  const [orderId, setOrderId] = useState("");
  const [fileId, setFileId] = useState("");
  const [result, setResult] = useState<FileStatusSuccessResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedOrderId = orderId.trim();
    const trimmedFileId = fileId.trim();

    setResult(null);
    setMessage(null);

    if (!trimmedOrderId || !trimmedFileId) {
      setMessage(EMPTY_INPUT_MESSAGE);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/file-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          order_id: trimmedOrderId,
          file_id: trimmedFileId
        }),
        cache: "no-store"
      });
      const payload = (await response.json()) as FileStatusResponse;

      if (!payload.success) {
        setMessage(payload.error_message);
        return;
      }

      setResult(payload);
    } catch {
      setMessage(NETWORK_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="file-status-widget">
      <form className="file-status-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="file-status-order-id">주문번호</label>
          <input
            id="file-status-order-id"
            name="order_id"
            autoComplete="off"
            placeholder="Cafe24 주문번호 예: 20260704-0000014"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
          />
          <p className="field-help">
            품목별 주문번호 끝에 -01, -02가 붙어 있어도 조회할 수 있습니다.
          </p>
        </div>
        <div className="field">
          <label htmlFor="file-status-file-id">업로드 파일 ID</label>
          <input
            id="file-status-file-id"
            name="file_id"
            autoComplete="off"
            placeholder="업로드 완료 후 안내받은 file_id를 입력해 주세요"
            value={fileId}
            onChange={(event) => setFileId(event.target.value)}
          />
        </div>
        <button className="button file-status-submit" type="submit" disabled={isLoading}>
          {isLoading ? "조회 중" : "상태 조회"}
        </button>
      </form>

      <div className="file-status-feedback" aria-live="polite">
        {message ? <div className="notice file-status-message">{message}</div> : null}

        {result ? (
          <section className="file-status-result" aria-label="파일 상태 조회 결과">
            <div className="file-status-result-header">
              <div>
                <p className="eyebrow">FILE STATUS</p>
                <h2>{result.status_label}</h2>
              </div>
              <span className="status">{result.status_label}</span>
            </div>

            <p className="file-status-customer-message">{result.customer_message}</p>

            <dl className="file-status-details">
              <div>
                <dt>파일명</dt>
                <dd>{result.file_name}</dd>
              </div>
              <div>
                <dt>업로드 파일 ID</dt>
                <dd>
                  <code>{result.file_id}</code>
                </dd>
              </div>
              <div>
                <dt>주문번호</dt>
                <dd>{result.order_id}</dd>
              </div>
              <div>
                <dt>업로드일</dt>
                <dd>{formatDateTime(result.uploaded_at)}</dd>
              </div>
            </dl>

            {result.reupload_required || result.reupload_status ? (
              <div className="file-status-reupload">
                <strong>{result.reupload_status_label ?? "재업로드 안내"}</strong>
                <p>{result.reupload_message ?? "안내받은 재업로드 링크를 이용해 주세요."}</p>
                {result.reupload_available && result.reupload_url ? (
                  <a className="button" href={result.reupload_url}>
                    재업로드 페이지 열기
                  </a>
                ) : (
                  <p className="file-status-small">
                    재업로드 링크는 보안상 이 화면에서 다시 표시하지 않습니다. 안내받은 재업로드 링크를 이용해 주세요.
                  </p>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
