import { getCafe24ConfigStatus } from "@/lib/cafe24/config";
import { getCafe24Installation } from "@/lib/cafe24/token-store";
import { getFileById, listRecentFiles } from "@/lib/files/file-service";
import type { UploadedFileRecord } from "@/lib/files/types";
import { getSupabaseConfigStatus } from "@/lib/supabase/admin";
import { getNaverStorageStatus } from "@/lib/storage/naver-object-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type FileLookupState = {
  query: string;
  file: UploadedFileRecord | null;
  message: string | null;
  status: "idle" | "found" | "not_found" | "empty" | "error";
};

type AdminPageProps = {
  searchParams?: {
    file_id?: string | string[];
  };
};

function readFileIdParam(searchParams?: AdminPageProps["searchParams"]) {
  const value = searchParams?.file_id;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function hasFileIdParam(searchParams?: AdminPageProps["searchParams"]) {
  return Boolean(searchParams && Object.prototype.hasOwnProperty.call(searchParams, "file_id"));
}

function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "미연결";
  }

  return String(value);
}

function formatBytes(value: number) {
  return `${value.toLocaleString()} bytes`;
}

async function lookupFileById(rawFileId: string, shouldSearch: boolean): Promise<FileLookupState> {
  const query = rawFileId.trim();

  if (!shouldSearch) {
    return { query: "", file: null, message: null, status: "idle" };
  }

  if (!query) {
    return { query: rawFileId, file: null, message: "file_id를 입력해 주세요.", status: "empty" };
  }

  try {
    const file = await getFileById(query);

    if (!file) {
      return {
        query,
        file: null,
        message: "해당 file_id의 업로드 파일을 찾지 못했습니다.",
        status: "not_found"
      };
    }

    return { query, file, message: null, status: "found" };
  } catch (error) {
    return {
      query,
      file: null,
      message: error instanceof Error ? error.message : "파일 조회에 실패했습니다.",
      status: "error"
    };
  }
}

async function getAdminData(fileIdQuery: string, shouldSearchFileId: boolean) {
  const cafe24 = getCafe24ConfigStatus();
  const supabase = getSupabaseConfigStatus();
  const storage = getNaverStorageStatus();
  let installation = null;
  let files: RecentUploadedFile[] = [];
  let dataError = null;
  const fileLookup = await lookupFileById(fileIdQuery, shouldSearchFileId);

  try {
    installation = await getCafe24Installation();
  } catch (error) {
    dataError = error instanceof Error ? error.message : "Failed to load admin data.";
  }

  try {
    files = await listRecentFiles(20);
  } catch (error) {
    dataError = dataError ?? (error instanceof Error ? error.message : "Failed to load recent files.");
  }

  return { cafe24, supabase, storage, installation, files, dataError, fileLookup };
}

function FileLookupField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="card">
      <span>{label}</span>
      <strong>{label === "file_size" && typeof value === "number" ? formatBytes(value) : formatNullable(value)}</strong>
    </div>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const fileIdQuery = readFileIdParam(searchParams);
  const data = await getAdminData(fileIdQuery, hasFileIdParam(searchParams));
  const isSupabaseConfigured = data.supabase.hasUrl && data.supabase.hasAnonKey && data.supabase.hasServiceRoleKey;

  return (
    <main className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <p className="eyebrow">ADMIN</p>
        <h1>Perpackage Cafe24 file upload admin</h1>
        <p className="lead">
          Phase 1 admin view checks connection status and recent uploaded file metadata. Tokens, storage secrets, and
          service role keys are never displayed.
        </p>
      </section>

      {data.dataError ? <div className="notice">{data.dataError}</div> : null}

      <section className="grid grid-3">
        <div className="card">
          <span>Cafe24</span>
          <strong>{data.cafe24.ok ? "configured" : "configuration required"}</strong>
          <p>{data.cafe24.ok ? data.cafe24.scopes.join(", ") : data.cafe24.missing.join(", ")}</p>
        </div>
        <div className="card">
          <span>Supabase</span>
          <strong>{isSupabaseConfigured ? "configured" : "configuration required"}</strong>
          <p>
            NEXT_PUBLIC_SUPABASE_URL: {data.supabase.hasUrl ? "present" : "missing"} / NEXT_PUBLIC_SUPABASE_ANON_KEY:{" "}
            {data.supabase.hasAnonKey ? "present" : "missing"} / SUPABASE_SERVICE_ROLE_KEY:{" "}
            {data.supabase.hasServiceRoleKey ? "present" : "missing"}
          </p>
        </div>
        <div className="card">
          <span>Naver Object Storage</span>
          <strong>
            {data.storage.hasEndpoint && data.storage.hasBucket && data.storage.hasAccessKey && data.storage.hasSecretKey
              ? "configured"
              : "configuration required"}
          </strong>
          <p>Only the presence of endpoint, bucket, access key, and secret key is displayed.</p>
        </div>
      </section>

      <section className="panel panel-pad">
        <h2>OAuth connection status</h2>
        <div className="grid grid-3">
          <div className="card"><span>mall_id</span><strong>{data.installation?.mall_id ?? "-"}</strong></div>
          <div className="card"><span>shop_no</span><strong>{data.installation?.shop_no ?? "-"}</strong></div>
          <div className="card"><span>status</span><strong>{data.installation?.status ?? "not_connected"}</strong></div>
          <div className="card"><span>access token expires</span><strong>{data.installation?.access_token_expires_at ?? "-"}</strong></div>
          <div className="card"><span>refresh token expires</span><strong>{data.installation?.refresh_token_expires_at ?? "-"}</strong></div>
          <div className="card"><span>scopes</span><strong>{data.installation?.scopes ?? "-"}</strong></div>
        </div>
      </section>

      <section className="panel panel-pad">
        <h2>파일 ID로 업로드 파일 찾기</h2>
        <p className="lead">
          Cafe24 관리자 주문상세에 표시된 “업로드 파일 ID”를 입력하면 저장된 파일 정보를 확인할 수 있습니다.
        </p>
        <form className="form" method="get" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="file_id">file_id</label>
            <input
              id="file_id"
              name="file_id"
              placeholder="Cafe24 주문상세의 업로드 파일 ID를 입력하세요"
              defaultValue={data.fileLookup.query}
            />
          </div>
          <button className="button" type="submit">파일 찾기</button>
        </form>

        {data.fileLookup.message ? (
          <div className="notice" style={{ marginTop: 16 }}>{data.fileLookup.message}</div>
        ) : null}

        {data.fileLookup.file ? (
          <div style={{ marginTop: 16 }}>
            <div className="grid grid-3">
              <FileLookupField label="file_id" value={data.fileLookup.file.id} />
              <FileLookupField label="original_filename" value={data.fileLookup.file.original_filename} />
              <FileLookupField label="mall_id" value={data.fileLookup.file.mall_id} />
              <FileLookupField label="shop_no" value={data.fileLookup.file.shop_no} />
              <FileLookupField label="product_no" value={data.fileLookup.file.product_no} />
              <FileLookupField label="variant_code" value={data.fileLookup.file.variant_code} />
              <FileLookupField label="customer_type" value={data.fileLookup.file.customer_type} />
              <FileLookupField label="file_size" value={data.fileLookup.file.file_size} />
              <FileLookupField label="mime_type" value={data.fileLookup.file.mime_type} />
              <FileLookupField label="storage_provider" value={data.fileLookup.file.storage_provider} />
              <FileLookupField label="storage_bucket" value={data.fileLookup.file.storage_bucket} />
              <FileLookupField label="storage_path" value={data.fileLookup.file.storage_path} />
              <FileLookupField label="status" value={data.fileLookup.file.status} />
              <FileLookupField label="order_id" value={data.fileLookup.file.order_id} />
              <FileLookupField label="inquiry_id" value={data.fileLookup.file.inquiry_id} />
              <FileLookupField label="created_at" value={data.fileLookup.file.created_at} />
              <FileLookupField label="updated_at" value={data.fileLookup.file.updated_at} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel panel-pad">
        <h2>Recent uploaded files</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File name</th>
                <th>mall/product</th>
                <th>Size</th>
                <th>MIME</th>
                <th>Status</th>
                <th>Uploaded at</th>
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
                  <td colSpan={6}>No recent uploaded files.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
