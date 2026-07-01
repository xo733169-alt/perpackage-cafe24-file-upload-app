"use client";

import { useMemo, useState } from "react";

type ReuploadRequestMessagePanelProps = {
  fileId: string;
  originalFilename: string;
  orderId: string | null;
  currentStatus: string;
};

const REUPLOAD_REASON_PRESETS = [
  {
    label: "폰트 아웃라인 필요",
    value: "폰트 아웃라인 처리가 필요합니다."
  },
  {
    label: "칼선 누락",
    value: "칼선 파일이 누락되어 확인이 필요합니다."
  },
  {
    label: "이미지 해상도 확인 필요",
    value: "이미지 해상도 확인이 필요합니다."
  },
  {
    label: "파일 열림 오류",
    value: "첨부 파일이 정상적으로 열리지 않아 재업로드가 필요합니다."
  },
  {
    label: "인쇄용 PDF/AI 파일 필요",
    value: "인쇄용 PDF 또는 AI 파일로 다시 전달이 필요합니다."
  },
  {
    label: "전개도 위치 확인 필요",
    value: "박스 전개도와 디자인 위치 확인이 필요합니다."
  }
];

function buildReuploadRequestMessage(input: {
  fileId: string;
  originalFilename: string;
  orderId: string | null;
  reason: string;
}) {
  const lines = [
    "안녕하세요. 페르패키지입니다.",
    "",
    "업로드해주신 인쇄 파일을 확인하던 중 추가 확인이 필요한 부분이 있어 연락드립니다.",
    "",
    `주문번호: ${input.orderId || "미연결"}`,
    `파일명: ${input.originalFilename}`,
    `업로드 파일 ID: ${input.fileId}`
  ];

  if (input.reason.trim()) {
    lines.push("", `확인 필요 사항: ${input.reason.trim()}`);
  }

  lines.push(
    "",
    "번거로우시겠지만 수정된 인쇄 파일을 다시 업로드해 주시면 확인 후 제작 진행 도와드리겠습니다.",
    "",
    "수정 파일 업로드 후 말씀 주시면 빠르게 확인하겠습니다.",
    "",
    "감사합니다."
  );

  return lines.join("\n");
}

export function ReuploadRequestMessagePanel({
  fileId,
  originalFilename,
  orderId,
  currentStatus
}: ReuploadRequestMessagePanelProps) {
  const [reason, setReason] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const message = useMemo(
    () => buildReuploadRequestMessage({ fileId, originalFilename, orderId, reason }),
    [fileId, originalFilename, orderId, reason]
  );
  const isNeedReupload = currentStatus === "need_reupload";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyMessage("복사되었습니다.");
    } catch {
      setCopyMessage("복사에 실패했습니다. 안내문을 직접 선택해 복사해 주세요.");
    }
  }

  function handlePresetClick(presetReason: string) {
    setReason(presetReason);
    setCopyMessage(null);
  }

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>재업로드 요청 안내문</h3>
        {isNeedReupload ? <span className="status status-warning">재업로드 요청 상태</span> : null}
      </div>
      <p>
        고객에게 전달할 안내문을 생성합니다. 사유는 화면에서만 반영되며 DB에는 저장하지 않습니다.
      </p>
      <div className="field">
        <label htmlFor={`reupload_reason_${fileId}`}>재업로드 요청 사유</label>
        <div style={{ marginBottom: 8 }}>
          <p style={{ margin: "0 0 6px" }}>자주 쓰는 사유</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {REUPLOAD_REASON_PRESETS.map((preset) => (
              <button
                className="button secondary"
                key={preset.label}
                onClick={() => handlePresetClick(preset.value)}
                style={{ padding: "6px 10px" }}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id={`reupload_reason_${fileId}`}
          onChange={(event) => {
            setReason(event.target.value);
            setCopyMessage(null);
          }}
          placeholder="예: 칼선 누락, 이미지 해상도 확인 필요, 폰트 아웃라인 필요, 파일 열림 오류 등"
          rows={3}
          value={reason}
        />
      </div>
      <div className="field">
        <label htmlFor={`reupload_message_${fileId}`}>고객 안내문</label>
        <textarea
          id={`reupload_message_${fileId}`}
          readOnly
          rows={12}
          value={message}
        />
      </div>
      <button className="button" onClick={handleCopy} type="button">
        안내문 복사
      </button>
      {copyMessage ? <p style={{ marginBottom: 0 }}>{copyMessage}</p> : null}
    </div>
  );
}
