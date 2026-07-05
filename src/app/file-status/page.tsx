import type { Metadata } from "next";
import { FileStatusLookupForm } from "@/components/FileStatusLookupForm";

export const metadata: Metadata = {
  title: "파일 상태 조회 | 페르패키지",
  description: "주문번호와 업로드 파일 ID로 인쇄용 파일 처리 상태를 확인합니다."
};

export default function FileStatusPage() {
  return (
    <main className="file-status-page">
      <section className="file-status-hero">
        <p className="eyebrow">PERPACKAGE FILE STATUS</p>
        <h1>업로드한 인쇄용 파일 상태를 확인해 주세요.</h1>
        <p className="lead">
          Cafe24 주문번호와 업로드 완료 후 안내받은 파일 ID를 입력하면 현재 파일 확인 상태를 조회할 수 있습니다.
          파일 다운로드와 내부 처리 이력은 관리자 확인용으로만 제공됩니다.
        </p>
      </section>

      <section className="file-status-panel">
        <div className="file-status-panel-heading">
          <div>
            <p className="eyebrow">STATUS LOOKUP</p>
            <h2>파일 상태 조회</h2>
          </div>
          <p>
            조회 결과가 나오지 않으면 주문번호와 업로드 파일 ID를 다시 확인해 주세요. 어떤 값이 맞고 틀렸는지는
            보안상 구분해서 안내하지 않습니다.
          </p>
        </div>
        <FileStatusLookupForm />
      </section>

      <section className="file-status-help">
        <h2>확인 전 안내</h2>
        <ul className="list">
          <li>파일 상태는 담당자 확인 상황에 따라 달라질 수 있습니다.</li>
          <li>재업로드가 필요한 경우 안내받은 재업로드 링크로 수정 파일을 올려 주세요.</li>
          <li>상태 조회 화면에서는 파일 다운로드 링크를 제공하지 않습니다.</li>
        </ul>
      </section>
    </main>
  );
}
