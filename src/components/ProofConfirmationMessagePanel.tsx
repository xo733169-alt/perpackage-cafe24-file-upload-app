"use client";

import { useMemo, useState } from "react";

type ProofConfirmationMessagePanelProps = {
  fileId: string;
  originalFilename: string;
  orderId: string | null;
};

const DEFAULT_PROOF_CHECK_ITEMS = [
  "인쇄 내용",
  "오탈자",
  "로고/이미지 위치",
  "칼선 기준 위치",
  "색상 참고 사항"
];

const PROOF_CONFIRMATION_PRESETS = [
  {
    label: "오탈자 확인 필요",
    value: "오탈자 여부를 확인해 주세요."
  },
  {
    label: "로고 위치 확인 필요",
    value: "로고 위치가 의도하신 위치와 맞는지 확인해 주세요."
  },
  {
    label: "칼선 기준 위치 확인",
    value: "칼선 기준으로 디자인 위치가 맞는지 확인해 주세요."
  },
  {
    label: "색상 참고 사항",
    value: "모니터 색상과 실제 인쇄 색상은 차이가 있을 수 있습니다."
  },
  {
    label: "후가공 위치 확인",
    value: "후가공 위치가 의도하신 위치와 맞는지 확인해 주세요."
  },
  {
    label: "수량/사이즈 확인",
    value: "주문 수량과 제작 사이즈를 다시 확인해 주세요."
  },
  {
    label: "접힘/뚜껑 방향 확인",
    value: "박스 접힘 방향과 뚜껑 방향을 확인해 주세요."
  }
];

function buildProofConfirmationMessage(input: {
  fileId: string;
  originalFilename: string;
  orderId: string | null;
  selectedItems: string[];
  memo: string;
}) {
  const checkItems = input.selectedItems.length > 0 ? input.selectedItems : DEFAULT_PROOF_CHECK_ITEMS;
  const numberedItems = checkItems.map((item, index) => `${index + 1}. ${item}`);
  const lines = [
    "안녕하세요. 페르패키지입니다.",
    "",
    "전달주신 인쇄 파일 기준으로 제작 전 교정 확인 안내드립니다.",
    "",
    `주문번호: ${input.orderId || "미연결"}`,
    `파일명: ${input.originalFilename}`,
    `업로드 파일 ID: ${input.fileId}`,
    "",
    "아래 내용 확인 부탁드립니다.",
    "",
    ...numberedItems
  ];

  if (input.memo.trim()) {
    lines.push("", `추가 확인 사항: ${input.memo.trim()}`);
  }

  lines.push(
    "",
    '교정 내용 확인 후 "확인했습니다"라고 회신 주시면 이후 제작 진행 단계로 넘어가겠습니다.',
    "",
    "수정이 필요한 부분이 있다면 함께 말씀 부탁드립니다.",
    "",
    "감사합니다."
  );

  return lines.join("\n");
}

export function ProofConfirmationMessagePanel({
  fileId,
  originalFilename,
  orderId
}: ProofConfirmationMessagePanelProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const message = useMemo(
    () => buildProofConfirmationMessage({ fileId, originalFilename, orderId, selectedItems, memo }),
    [fileId, originalFilename, memo, orderId, selectedItems]
  );

  function handlePresetClick(item: string) {
    setSelectedItems((currentItems) =>
      currentItems.includes(item)
        ? currentItems.filter((currentItem) => currentItem !== item)
        : [...currentItems, item]
    );
    setCopyMessage(null);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyMessage("복사되었습니다.");
    } catch {
      setCopyMessage("복사에 실패했습니다. 안내문을 직접 선택해 복사해 주세요.");
    }
  }

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>교정확인 안내문</h3>
        <span className="status">관리자 확인용</span>
      </div>
      <p>
        제작 전 고객에게 전달할 교정확인 안내문을 생성합니다. 선택 항목과 메모는 화면에서만 반영되며 DB에는 저장하지 않습니다.
      </p>
      <div className="field">
        <label>교정확인 항목</label>
        <div style={{ marginBottom: 8 }}>
          <p style={{ margin: "0 0 6px" }}>자주 쓰는 확인 항목</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PROOF_CONFIRMATION_PRESETS.map((preset) => {
              const isSelected = selectedItems.includes(preset.value);

              return (
                <button
                  aria-pressed={isSelected}
                  className={isSelected ? "button" : "button secondary"}
                  key={preset.label}
                  onClick={() => handlePresetClick(preset.value)}
                  style={{ padding: "6px 10px" }}
                  type="button"
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
        <p style={{ marginTop: 8 }}>
          선택한 항목이 없으면 기본 확인 목록이 안내문에 표시됩니다. 버튼은 여러 개를 동시에 선택할 수 있습니다.
        </p>
      </div>
      <div className="field">
        <label htmlFor={`proof_confirmation_memo_${fileId}`}>추가 확인 메모</label>
        <textarea
          id={`proof_confirmation_memo_${fileId}`}
          onChange={(event) => {
            setMemo(event.target.value);
            setCopyMessage(null);
          }}
          placeholder="예: 특정 문구, 로고 위치, 색상 참고 사항 등 고객에게 추가로 확인받을 내용을 적어주세요."
          rows={3}
          value={memo}
        />
      </div>
      <div className="field">
        <label htmlFor={`proof_confirmation_message_${fileId}`}>고객 안내문</label>
        <textarea
          id={`proof_confirmation_message_${fileId}`}
          readOnly
          rows={14}
          value={message}
        />
      </div>
      <button className="button" onClick={handleCopy} type="button">
        교정확인 안내문 복사
      </button>
      {copyMessage ? <p style={{ marginBottom: 0 }}>{copyMessage}</p> : null}
    </div>
  );
}
