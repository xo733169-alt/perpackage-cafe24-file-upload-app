"use client";

import { useState } from "react";

type UploadResult = {
  ok: boolean;
  message?: string;
  file?: {
    id: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    status: string;
    created_at: string;
  };
};

export function UploadTestForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUploading(true);
    setResult(null);
    setError(null);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({})) as UploadResult;

      if (!response.ok || !data.ok) {
        setError(data.message ?? "파일 업로드에 실패했습니다.");
        return;
      }

      setResult(data);
      form.reset();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="form panel panel-pad" onSubmit={handleSubmit}>
      <div className="grid grid-3">
        <div className="field">
          <label htmlFor="mall_id">mall_id</label>
          <input id="mall_id" name="mall_id" defaultValue="peerl" />
        </div>
        <div className="field">
          <label htmlFor="shop_no">shop_no</label>
          <input id="shop_no" name="shop_no" placeholder="1" />
        </div>
        <div className="field">
          <label htmlFor="product_no">product_no</label>
          <input id="product_no" name="product_no" placeholder="상품 번호" />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="field">
          <label htmlFor="variant_code">variant_code</label>
          <input id="variant_code" name="variant_code" placeholder="옵션 코드" />
        </div>
        <div className="field">
          <label htmlFor="customer_type">customer_type</label>
          <select id="customer_type" name="customer_type" defaultValue="guest">
            <option value="guest">guest</option>
            <option value="member">member</option>
            <option value="admin-test">admin-test</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="customer_identifier">customer_identifier</label>
          <input id="customer_identifier" name="customer_identifier" placeholder="member id 또는 테스트 식별자" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="file">테스트 파일</label>
        <input id="file" name="file" type="file" required />
      </div>

      <button className="button" type="submit" disabled={isUploading}>
        {isUploading ? "업로드 중" : "테스트 업로드"}
      </button>

      <p className="notice">
        1차 테스트 페이지는 작은 파일 기준입니다. 대용량 multipart upload, presigned URL, 바이러스 검사는 다음 Phase에서 구현합니다.
      </p>

      {error ? <div className="notice">{error}</div> : null}
      {result?.file ? (
        <pre className="result">{JSON.stringify(result.file, null, 2)}</pre>
      ) : null}
    </form>
  );
}
