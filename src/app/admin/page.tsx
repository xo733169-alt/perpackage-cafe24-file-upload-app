import { getCafe24ConfigStatus } from "@/lib/cafe24/config";
import { getCafe24Installation } from "@/lib/cafe24/token-store";
import { listRecentFiles } from "@/lib/files/file-service";
import type { UploadedFileRecord } from "@/lib/files/types";
import { getSupabaseConfigStatus } from "@/lib/supabase/admin";
import { getNaverStorageStatus } from "@/lib/storage/naver-object-storage";

type RecentUploadedFile = Pick<
  UploadedFileRecord,
  | "id"
  | "original_filename"
  | "mall_id"
  | "product_no"
  | "file_size"
  | "mime_type"
  | "status"
  | "created_at"
>;

async function getAdminData() {
  const cafe24 = getCafe24ConfigStatus();
  const supabase = getSupabaseConfigStatus();
  const storage = getNaverStorageStatus();
  let installation = null;
  let files: RecentUploadedFile[] = [];
  let dataError = null;

  try {
    installation = await getCafe24Installation();
  } catch (error) {
    dataError = error instanceof Error ? error.message : "관리 데이터 조회 실패";
  }

  try {
    files = await listRecentFiles(20);
  } catch (error) {
    dataError = dataError ?? (error instanceof Error ? error.message : "파일 목록 조회 실패");
  }

  return { cafe24, supabase, storage, installation, files, dataError };
}

export default async function AdminPage() {
  const data = await getAdminData();

  return (
    <main className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <p className="eyebrow">ADMIN</p>
        <h1>페르패키지 Cafe24 파일 업로드 앱 관리자</h1>
        <p className="lead">
          1차 화면에서는 연결 상태와 최근 업로드 메타데이터만 확인합니다. token 원문, storage secret, service role key는 표시하지 않습니다.
        </p>
      </section>

      {data.dataError ? <div className="notice">{data.dataError}</div> : null}

      <section className="grid grid-3">
        <div className="card">
          <span>Cafe24</span>
          <strong>{data.cafe24.ok ? "설정 준비됨" : "설정 필요"}</strong>
          <p>{data.cafe24.ok ? data.cafe24.scopes.join(", ") : data.cafe24.missing.join(", ")}</p>
        </div>
        <div className="card">
          <span>Supabase</span>
          <strong>{data.supabase.hasUrl && data.supabase.hasServiceRoleKey ? "서버 연결 설정 있음" : "설정 필요"}</strong>
          <p>URL: {data.supabase.hasUrl ? "present" : "missing"} / service role: {data.supabase.hasServiceRoleKey ? "present" : "missing"}</p>
        </div>
        <div className="card">
          <span>Naver Object Storage</span>
          <strong>{data.storage.hasEndpoint && data.storage.hasBucket && data.storage.hasAccessKey && data.storage.hasSecretKey ? "설정 있음" : "설정 필요"}</strong>
          <p>endpoint, bucket, access key, secret key 존재 여부만 표시합니다.</p>
        </div>
      </section>

      <section className="panel panel-pad">
        <h2>OAuth 연결 상태</h2>
        <div className="grid grid-3">
          <div className="card"><span>mall_id</span><strong>{data.installation?.mall_id ?? "-"}</strong></div>
          <div className="card"><span>shop_no</span><strong>{data.installation?.shop_no ?? "-"}</strong></div>
          <div className="card"><span>status</span><strong>{data.installation?.status ?? "not_connected"}</strong></div>
          <div className="card"><span>access token 만료</span><strong>{data.installation?.access_token_expires_at ?? "-"}</strong></div>
          <div className="card"><span>refresh token 만료</span><strong>{data.installation?.refresh_token_expires_at ?? "-"}</strong></div>
          <div className="card"><span>scopes</span><strong>{data.installation?.scopes ?? "-"}</strong></div>
        </div>
      </section>

      <section className="panel panel-pad">
        <h2>최근 업로드 파일</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>파일명</th>
                <th>mall/product</th>
                <th>크기</th>
                <th>MIME</th>
                <th>상태</th>
                <th>업로드 시각</th>
              </tr>
            </thead>
            <tbody>
              {data.files.length ? data.files.map((file) => (
                <tr key={file.id}>
                  <td>{file.original_filename}</td>
                  <td>{file.mall_id ?? "-"} / {file.product_no ?? "-"}</td>
                  <td>{file.file_size.toLocaleString()} bytes</td>
                  <td>{file.mime_type}</td>
                  <td><span className="status">{file.status}</span></td>
                  <td>{file.created_at}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6}>최근 업로드 파일이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
