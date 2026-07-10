import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "페르패키지 Cafe24 파일 업로드 앱",
  description: "페르패키지 Cafe24 주문 파일 접수 및 관리 앱"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const showDevelopmentTools = process.env.NODE_ENV !== "production";

  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <a className="brand" href="/">
              <strong>페르패키지 파일 업로드 앱</strong>
              <span>CAFE24 INTERNAL APP</span>
            </a>
            <nav className="nav" aria-label="앱 메뉴">
              <a href="/">앱 실행</a>
              {showDevelopmentTools ? <a href="/upload-test">업로드 테스트</a> : null}
              <a href="/admin">관리자</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
