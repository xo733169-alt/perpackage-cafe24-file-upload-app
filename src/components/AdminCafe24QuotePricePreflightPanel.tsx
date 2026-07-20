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
  ready_for_price_write: boolean;
};

type PreflightResponse =
  | { ok: true; comparison: PricePreflightComparison }
  | { ok: false; message?: string };

function formatWon(value: number | null) {
  return value === null ? "확인 불가" : `${value.toLocaleString()}원`;
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
        </div>
      ) : null}
    </section>
  );
}
