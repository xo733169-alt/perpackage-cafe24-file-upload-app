"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AdminDownloadLink } from "@/components/AdminDownloadLogRefreshControls";
import { isActiveReuploadRequest } from "@/lib/files/reupload-request-policy";
import type { FileReuploadRequestRecord } from "@/lib/files/reupload-request-service";

type ReuploadLinkCreatePanelProps = {
  fileId: string;
  originalFilename: string;
  orderId: string | null;
  initialRequests: FileReuploadRequestRecord[];
};

type CreateReuploadRequestResponse = {
  ok: boolean;
  message?: string;
  reupload_url?: string;
  request?: FileReuploadRequestRecord;
};

const STATUS_LABELS: Record<string, string> = {
  requested: "재업로드 요청",
  uploaded: "재업로드 완료",
  reviewing: "확인 중",
  completed: "처리 완료",
  expired: "만료됨",
  canceled: "취소됨",
  failed: "실패"
};

function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function getStatusClassName(status: string) {
  if (status === "uploaded" || status === "completed") {
    return "status status-success";
  }

  if (status === "expired" || status === "canceled" || status === "failed") {
    return "status status-warning";
  }

  return "status";
}

function formatEmpty(value: string | null | undefined) {
  return value?.trim() || "-";
}

function hasActiveRequestedRequest(requests: FileReuploadRequestRecord[]) {
  return requests.some((request) => isActiveReuploadRequest(request));
}

function getShortFileId(fileId: string) {
  return fileId.length > 12 ? `${fileId.slice(0, 8)}...` : fileId;
}

export function ReuploadLinkCreatePanel({
  fileId,
  originalFilename,
  orderId,
  initialRequests
}: ReuploadLinkCreatePanelProps) {
  const [reason, setReason] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [requests, setRequests] = useState(initialRequests);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasActiveRequest = useMemo(() => hasActiveRequestedRequest(requests), [requests]);
  const completedReuploadRequests = useMemo(
    () => requests.filter((request) => request.status === "uploaded" && request.new_file_id),
    [requests]
  );

  async function copyText(value: string, successMessage: string) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatusMessage(successMessage);
      setErrorMessage(null);
    } catch {
      setStatusMessage(null);
      setErrorMessage("복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setGeneratedUrl("");
    setGeneratedMessage("");

    try {
      const response = await fetch("/api/admin/reupload-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          original_file_id: fileId,
          reason,
          customer_message: customerMessage
        })
      });
      const result = await response.json() as CreateReuploadRequestResponse;

      if (!response.ok || !result.ok || !result.request || !result.reupload_url || !result.message) {
        throw new Error(result.message || "재업로드 요청 생성에 실패했습니다.");
      }

      setRequests((currentRequests) => [result.request!, ...currentRequests]);
      setGeneratedUrl(result.reupload_url);
      setGeneratedMessage(result.message);
      setStatusMessage("재업로드 링크가 생성되었습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "재업로드 요청 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>재업로드 요청 생성</h3>
      <p>
        요청 사유와 고객 안내를 한 번 입력하면 요청 기록, 7일 유효 링크, 복사용 안내문을 함께 생성합니다.
        보안 token 원문은 생성된 링크에만 사용하며 DB에는 저장하지 않습니다.
      </p>
      {hasActiveRequest ? (
        <div className="notice" style={{ marginTop: 12 }}>
          기존 유효 요청이 있습니다. 중복 요청을 만들지 않고 기존 요청을 사용해 주세요.
        </div>
      ) : null}
      <div className="grid grid-3" style={{ marginTop: 12 }}>
        <div className="card">
          <span>기존 파일명</span>
          <strong>{originalFilename}</strong>
        </div>
        <div className="card">
          <span>file_id</span>
          <strong>{fileId}</strong>
        </div>
        <div className="card">
          <span>주문번호</span>
          <strong>{orderId ?? "미연결"}</strong>
        </div>
      </div>
      <form className="form" onSubmit={handleSubmit} style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor={`reupload_link_reason_${fileId}`}>재업로드 요청 사유</label>
          <textarea
            id={`reupload_link_reason_${fileId}`}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 칼선 파일이 누락되어 수정 파일 재업로드가 필요합니다."
            required
            rows={3}
            value={reason}
          />
        </div>
        <div className="field">
          <label htmlFor={`reupload_link_customer_message_${fileId}`}>고객 안내 추가 문구</label>
          <textarea
            id={`reupload_link_customer_message_${fileId}`}
            onChange={(event) => setCustomerMessage(event.target.value)}
            placeholder="고객에게 추가로 안내할 내용이 있으면 입력하세요."
            rows={3}
            value={customerMessage}
          />
        </div>
        <button className="button" disabled={isSubmitting || hasActiveRequest} type="submit">
          {isSubmitting ? "생성 중..." : "재업로드 요청 생성"}
        </button>
      </form>

      {statusMessage ? <p style={{ marginBottom: 0 }}>{statusMessage}</p> : null}
      {errorMessage ? <p style={{ color: "#b42318", marginBottom: 0 }}>{errorMessage}</p> : null}

      {generatedUrl ? (
        <div style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor={`reupload_link_url_${fileId}`}>생성된 재업로드 링크</label>
            <input id={`reupload_link_url_${fileId}`} readOnly value={generatedUrl} />
          </div>
          <button
            className="button secondary"
            onClick={() => copyText(generatedUrl, "재업로드 링크가 복사되었습니다.")}
            type="button"
          >
            생성된 링크 복사
          </button>
        </div>
      ) : null}

      {generatedMessage ? (
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor={`reupload_link_message_${fileId}`}>고객 안내문</label>
          <textarea
            id={`reupload_link_message_${fileId}`}
            readOnly
            rows={14}
            value={generatedMessage}
          />
          <button
            className="button secondary"
            onClick={() => copyText(generatedMessage, "재업로드 안내문이 복사되었습니다.")}
            style={{ marginTop: 8 }}
            type="button"
          >
            생성된 안내문 복사
          </button>
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <h3>재업로드 요청 이력</h3>

        {completedReuploadRequests.length ? (
          <div className="notice" style={{ marginTop: 12, marginBottom: 12 }}>
            <p style={{ marginBottom: 8 }}>
              이 파일은 재업로드 요청을 통해 새 파일이 등록되었습니다. 새 파일은 별도 파일로 저장되며,
              기존 파일은 자동 삭제/자동 교체되지 않습니다.
            </p>
            <ul style={{ marginBottom: 8 }}>
              {completedReuploadRequests.map((request) => (
                <li key={request.id}>
                  새 파일 ID: <code>{request.new_file_id}</code>
                </li>
              ))}
            </ul>
            <p style={{ marginBottom: 0 }}>
              새 파일을 다운로드하여 확인한 뒤, 필요하면 새 파일 상태를 “파일 확인 중” 또는 “파일 확인 완료”로 직접 변경하세요.
              기존 파일을 교체 처리하려면 관리자가 직접 기존 파일 상태를 “새 파일로 교체됨”으로 변경하세요.
            </p>
          </div>
        ) : null}

        {requests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>요청일시</th>
                  <th>상태</th>
                  <th>사유</th>
                  <th>만료일시</th>
                  <th>사용일시</th>
                  <th>새 파일 ID</th>
                  <th>새 파일 처리</th>
                  <th>생성자</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.created_at}</td>
                    <td>
                      <span className={getStatusClassName(request.status)}>{formatStatus(request.status)}</span>
                    </td>
                    <td>{formatEmpty(request.reason)}</td>
                    <td>{request.expires_at}</td>
                    <td>{formatEmpty(request.used_at)}</td>
                    <td>
                      {request.new_file_id ? (
                        <code title={request.new_file_id}>{getShortFileId(request.new_file_id)}</code>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {request.new_file_id ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <button
                            className="button secondary button-small"
                            onClick={() => copyText(request.new_file_id!, "새 파일 ID가 복사되었습니다.")}
                            type="button"
                          >
                            새 파일 ID 복사
                          </button>
                          <a
                            className="button secondary button-small"
                            href={`/admin?tab=files&file_id=${encodeURIComponent(request.new_file_id)}`}
                          >
                            새 파일 상세 보기
                          </a>
                          <AdminDownloadLink
                            className="button secondary button-small"
                            href={`/api/files/download?file_id=${encodeURIComponent(request.new_file_id)}`}
                          >
                            새 파일 다운로드
                          </AdminDownloadLink>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{formatEmpty(request.created_by)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>아직 재업로드 요청 이력이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
