import { UploadTestForm } from "@/components/upload-test-form";

export default function UploadTestPage() {
  return (
    <main className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <p className="eyebrow">UPLOAD TEST</p>
        <h1>개발용 파일 업로드 테스트</h1>
        <p className="lead">
          Cafe24 상품상세에 붙이기 전, 서버 API와 Naver Object Storage, Supabase files 테이블 저장 흐름을 확인하는 화면입니다.
        </p>
      </section>
      <UploadTestForm />
    </main>
  );
}
