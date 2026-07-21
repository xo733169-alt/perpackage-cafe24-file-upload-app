"use client";

import { useState } from "react";

type PricePreflightComparison = {
  cafe24_product_no: string;
  quote_product_code: string;
  quote_version_no: number;
  recommended_base_price: number;
  cafe24_base_price: number | null;
  base_price_mismatch: boolean;
  quote_variant_count: number;
  cafe24_variant_count: number;
  readable_cafe24_variant_count: number;
  unreadable_cafe24_variant_count: number;
  duplicate_quote_option_key_count: number;
  duplicate_cafe24_variant_key_count: number;
  missing_expected_variant_count: number;
  unexpected_cafe24_variant_count: number;
  price_mismatch_count: number;
  price_mismatch_reason_summary: Array<{
    reason: string;
    count: number;
  }>;
  price_sync_plan_count: number;
  price_sync_plan: Array<{
    option_key: string;
    option_values: string[];
    expected_additional_amount: number;
    cafe24_additional_amount: number | null;
    planned_additional_amount: number;
    difference_amount: number | null;
    reason: string;
    operation: "set_additional_amount";
  }>;
  price_mismatch_examples: Array<{
    option_values: string[];
    expected_additional_amount: number;
    cafe24_additional_amount: number | null;
    difference_amount: number | null;
    reason: string;
  }>;
  ready_for_price_write: boolean;
};

type PreflightResponse =
  | { ok: true; comparison: PricePreflightComparison }
  | { ok: false; message?: string };

function formatWon(value: number | null) {
  return value === null ? "확인 불가" : `${value.toLocaleString()}원`;
}

function formatSignedWon(value: number | null) {
  if (value === null) {
    return "확인 불가";
  }

  return `${value > 0 ? "+" : ""}${value.toLocaleString()}원`;
}

function toCsvCell(value: string | number | null) {
  const stringValue = String(value ?? "");
  const safeValue = /^[=+\-@]/.test(stringValue)
    ? `'${stringValue}`
    : stringValue;

  return `"${safeValue.replace(/"/g, "\"\"")}"`;
}

function getMismatchReasonLabel(reason: string) {
  switch (reason) {
    case "cafe24_additional_amount_missing":
      return "Cafe24 추가금 확인 불가";
    case "cafe24_additional_amount_zero":
      return "Cafe24 추가금 0원";
    case "cafe24_additional_amount_lower":
      return "Cafe24 추가금 낮음";
    case "cafe24_additional_amount_higher":
      return "Cafe24 추가금 높음";
    default:
      return "확인 필요";
  }
}

function getResultMessage(comparison: PricePreflightComparison) {
  if (comparison.ready_for_price_write) {
    return "견적 매트릭스와 Cafe24 조합 가격이 모두 일치합니다. 실제 가격 반영 기능은 별도 승인 단계에서만 진행합니다.";
  }

  return "차이가 있는 항목이 있습니다. 실제 Cafe24 판매가나 옵션을 변경하지 말고, 아래 수치를 먼저 확인해 주세요.";
}

export function AdminCafe24QuotePricePreflightPanel() {
  const [comparison, setComparison] = useState<PricePreflightComparison | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRunPreflight() {
    if (isLoading) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/cafe24/products/76/quote-price-preflight", {
        cache: "no-store"
      });
      const result = await response.json().catch(() => null) as PreflightResponse | null;

      if (!response.ok || !result || !result.ok) {
        setComparison(null);
        setMessage(result && !result.ok && result.message ? result.message : "가격 사전 점검을 완료하지 못했습니다.");
        return;
      }

      setComparison(result.comparison);
    } catch {
      setComparison(null);
      setMessage("네트워크 오류로 가격 사전 점검을 완료하지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  function downloadPriceSyncPlan() {
    if (!comparison || comparison.price_sync_plan.length === 0) return;

    const header = [
      "Option key",
      "Option values",
      "Current Cafe24 additional amount",
      "Quote additional amount",
      "Planned Cafe24 additional amount",
      "Difference",
      "Mismatch reason",
      "Planned operation"
    ];
    const rows = comparison.price_sync_plan.map((item) => [
      item.option_key,
      item.option_values.join(" / "),
      item.cafe24_additional_amount,
      item.expected_additional_amount,
      item.planned_additional_amount,
      item.difference_amount,
      getMismatchReasonLabel(item.reason),
      item.operation
    ]);
    const csv = `\uFEFF${[header, ...rows]
      .map((row) => row.map(toCsvCell).join(","))
      .join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = `cafe24-quote-price-plan-product-${comparison.cafe24_product_no}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <section className="panel panel-pad" id="cafe24-quote-price-preflight">
      <h2>Cafe24 견적 가격 사전 점검</h2>
      <p className="lead">
        원터치박스 활성 견적 600건과 Cafe24 실제 조합 가격을 읽기 전용으로 비교합니다.
        이 점검은 상품, 옵션, 판매가를 변경하지 않습니다.
      </p>
      <button className="button" disabled={isLoading} onClick={handleRunPreflight} type="button">
        {isLoading ? "가격 비교 중..." : "현재 조합 가격 점검"}
      </button>

      {message ? <div className="notice" style={{ marginTop: 16 }}>{message}</div> : null}

      {comparison ? (
        <div style={{ marginTop: 18 }}>
          <div className="notice" style={{ marginBottom: 16 }}>
            {getResultMessage(comparison)}
          </div>
          {comparison.price_sync_plan_count > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <p className="lead" style={{ marginTop: 0 }}>
                전체 {comparison.price_sync_plan_count.toLocaleString()}건의 반영 계획을 CSV로 내려받아 검토할 수 있습니다. 이 파일은 실제 Cafe24 가격을 변경하지 않습니다.
              </p>
              <button className="button" onClick={downloadPriceSyncPlan} type="button">
                전체 반영 계획 CSV 내려받기
              </button>
            </div>
          ) : null}
          <div className="grid grid-3">
            <div className="card"><span>견적 기준가</span><strong>{formatWon(comparison.recommended_base_price)}</strong></div>
            <div className="card"><span>Cafe24 기본가</span><strong>{formatWon(comparison.cafe24_base_price)}</strong></div>
            <div className="card"><span>기본가 일치</span><strong>{comparison.base_price_mismatch ? "불일치" : "일치"}</strong></div>
            <div className="card"><span>견적 조합</span><strong>{comparison.quote_variant_count.toLocaleString()}건</strong></div>
            <div className="card"><span>Cafe24 조합</span><strong>{comparison.cafe24_variant_count.toLocaleString()}건</strong></div>
            <div className="card"><span>추가금 불일치</span><strong>{comparison.price_mismatch_count.toLocaleString()}건</strong></div>
            <div className="card"><span>견적 조합 중복</span><strong>{comparison.duplicate_quote_option_key_count.toLocaleString()}건</strong></div>
            <div className="card"><span>Cafe24 조합 중복</span><strong>{comparison.duplicate_cafe24_variant_key_count.toLocaleString()}건</strong></div>
            <div className="card"><span>읽을 수 없는 Cafe24 조합</span><strong>{comparison.unreadable_cafe24_variant_count.toLocaleString()}건</strong></div>
            <div className="card"><span>누락된 Cafe24 조합</span><strong>{comparison.missing_expected_variant_count.toLocaleString()}건</strong></div>
            <div className="card"><span>예상 밖 Cafe24 조합</span><strong>{comparison.unexpected_cafe24_variant_count.toLocaleString()}건</strong></div>
            <div className="card"><span>다음 단계 가능</span><strong>{comparison.ready_for_price_write ? "검토 가능" : "불가"}</strong></div>
          </div>
          {comparison.price_mismatch_count > 0 ? (
            <section aria-label="추가금 불일치 원인" style={{ marginTop: 20 }}>
              <h3 style={{ marginBottom: 8 }}>추가금 불일치 원인</h3>
              <p className="lead" style={{ marginTop: 0 }}>
                실제 Cafe24 가격과 옵션은 변경하지 않습니다. 최대 50건의 예시만 표시합니다.
              </p>
              <div className="grid grid-3" style={{ marginBottom: 16 }}>
                {comparison.price_mismatch_reason_summary.map((item) => (
                  <div className="card" key={item.reason}>
                    <span>{getMismatchReasonLabel(item.reason)}</span>
                    <strong>{item.count.toLocaleString()}건</strong>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">옵션</th>
                      <th scope="col">견적 추가금</th>
                      <th scope="col">Cafe24 추가금</th>
                      <th scope="col">차이</th>
                      <th scope="col">원인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.price_mismatch_examples.map((example, index) => (
                      <tr key={`${example.option_values.join("|")}-${index}`}>
                        <td>{example.option_values.join(" / ")}</td>
                        <td>{formatWon(example.expected_additional_amount)}</td>
                        <td>{formatWon(example.cafe24_additional_amount)}</td>
                        <td>{formatSignedWon(example.difference_amount)}</td>
                        <td>{getMismatchReasonLabel(example.reason)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
