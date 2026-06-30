import { linkFileOrderIdAction, loginAdminAction, logoutAdminAction } from "@/app/admin/actions";
import { getAdminAuthConfigStatus, isAdminAuthenticated } from "@/lib/admin/auth";
import { getCafe24ConfigStatus } from "@/lib/cafe24/config";
import { getCafe24Installation } from "@/lib/cafe24/token-store";
import { listFileDownloadLogs, type FileDownloadLogRecord } from "@/lib/files/download-log-service";
import { getFileById, listFilesByOrderId, listRecentFiles } from "@/lib/files/file-service";
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
  downloadLogs: FileDownloadLogRecord[];
  message: string | null;
  status: "idle" | "found" | "not_found" | "empty" | "error";
};

type OrderLookupState = {
  query: string;
  files: UploadedFileRecord[];
  message: string | null;
  status: "idle" | "found" | "not_found" | "empty" | "error";
};

type AdminPageProps = {
  searchParams?: {
    auth?: string | string[];
    file_id?: string | string[];
    order_link?: string | string[];
    order_id?: string | string[];
  };
};

function readParam(searchParams: AdminPageProps["searchParams"], key: "auth" | "file_id" | "order_link" | "order_id") {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function hasFileIdParam(searchParams?: AdminPageProps["searchParams"]) {
  return Boolean(searchParams && Object.prototype.hasOwnProperty.call(searchParams, "file_id"));
}

function hasOrderIdParam(searchParams?: AdminPageProps["searchParams"]) {
  return Boolean(searchParams && Object.prototype.hasOwnProperty.call(searchParams, "order_id"));
}

function formatEmpty(value: string | number | null | undefined, emptyText = "-") {
  if (value === null || value === undefined || value === "") {
    return emptyText;
  }

  return String(value);
}

function formatBytes(value: number) {
  return `${value.toLocaleString()} bytes`;
}

function shortenUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return "-";
  }

  return userAgent.length > 90 ? `${userAgent.slice(0, 90)}...` : userAgent;
}

function getOrderLinkMessage(status: string) {
  switch (status) {
    case "success":
      return "주문번호를 연결했습니다.";
    case "empty_order_id":
      return "주문번호를 입력해 주세요.";
    case "missing_file_id":
      return "file_id를 확인할 수 없습니다.";
    case "file_not_found":
      return "해당 file_id의 업로드 파일을 찾지 못했습니다.";
    case "failed":
      return "주문번호 연결에 실패했습니다.";
    default:
      return "";
  }
}

async function lookupFileById(rawFileId: string, shouldSearch: boolean): Promise<FileLookupState> {
  const query = rawFileId.trim();

  if (!shouldSearch) {
    return { query: "", file: null, downloadLogs: [], message: null, status: "idle" };
  }

  if (!query) {
    return { query: rawFileId, file: null, downloadLogs: [], message: "file_id를 입력해 주세요.", status: "empty" };
  }

  try {
    const file = await getFileById(query);

    if (!file) {
      return {
        query,
        file: null,
        downloadLogs: [],
        message: "해당 file_id의 업로드 파일을 찾지 못했습니다.",
        status: "not_found"
      };
    }

    const downloadLogs = await listFileDownloadLogs(file.id, 5);
    return { query, file, downloadLogs, message: null, status: "found" };
  } catch (error) {
    return {
      query,
      file: null,
      downloadLogs: [],
      message: error instanceof Error ? error.message : "파일 조회에 실패했습니다.",
      status: "error"
    };
  }
}

async function lookupFilesByOrderId(rawOrderId: string, shouldSearch: boolean): Promise<OrderLookupState> {
  const query = rawOrderId.trim();

  if (!shouldSearch) {
    return { query: "", files: [], message: null, status: "idle" };
  }

  if (!query) {
    return { query: rawOrderId, files: [], message: "주문번호를 입력해 주세요.", status: "empty" };
  }

  try {
    const files = await listFilesByOrderId(query);

    if (!files.length) {
      return {
        query,
        files: [],
        message: "해당 주문번호에 연결된 업로드 파일이 없습니다.",
        status: "not_found"
      };
    }

    return { query, files, message: null, status: "found" };
  } catch (error) {
    return {
      query,
      files: [],
      message: error instanceof Error ? error.message : "주문번호 기준 파일 조회에 실패했습니다.",
      status: "error"
    };
  }
}

async function getAdminData(
  fileIdQuery: string,
  shouldSearchFileId: boolean,
  orderIdQuery: string,
  shouldSearchOrderId: boolean
) {
  const cafe24 = getCafe24ConfigStatus();
  const supabase = getSupabaseConfigStatus();
  const storage = getNaverStorageStatus();
  let installation = null;
  let files: RecentUploadedFile[] = [];
  let dataError = null;
  const [fileLookup, orderLookup] = await Promise.all([
    lookupFileById(fileIdQuery, shouldSearchFileId),
    lookupFilesByOrderId(orderIdQuery, shouldSearchOrderId)
  ]);

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

  return { cafe24, supabase, storage, installation, files, dataError, fileLookup, orderLookup };
}

function FileLookupField({
  label,
  value,
  emptyText
}: {
  label: string;
  value: string | number | null | undefined;
  emptyText?: string;
}) {
  return (
    <div className="card">
      <span>{label}</span>
      <strong>{label === "file_size" && typeof value === "number" ? formatBytes(value) : formatEmpty(value, emptyText)}</strong>
    </div>
  );
}

function DownloadPanel({ file }: { file: UploadedFileRecord }) {
  const canDownload =
    file.storage_provider === "naver-object-storage" &&
    Boolean(file.storage_bucket) &&
    Boolean(file.storage_path);

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <p style={{ marginTop: 0 }}>다운로드 링크는 짧은 시간 동안만 유효합니다.</p>
      {canDownload ? (
        <a
          className="button"
          href={`/api/files/download?file_id=${encodeURIComponent(file.id)}`}
          rel="noreferrer"
          target="_blank"
        >
          파일 다운로드
        </a>
      ) : (
        <p style={{ marginBottom: 0 }}>다운로드에 필요한 저장소 정보가 아직 충분하지 않습니다.</p>
      )}
    </div>
  );
}

function DownloadLogPanel({ logs }: { logs: FileDownloadLogRecord[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3>최근 다운로드 로그</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>downloaded_at</th>
              <th>result</th>
              <th>ip_address</th>
              <th>user_agent</th>
              <th>error_message</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((log) => (
              <tr key={log.id}>
                <td>{log.downloaded_at}</td>
                <td><span className="status">{log.result}</span></td>
                <td>{log.ip_address ?? "-"}</td>
                <td>{shortenUserAgent(log.user_agent)}</td>
                <td>{log.error_message ?? "-"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>아직 이 파일의 다운로드 로그가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderLinkPanel({
  file,
  message
}: {
  file: UploadedFileRecord;
  message: string;
}) {
  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>주문번호 연결</h3>
      <p>
        현재 연결된 주문번호: <strong>{file.order_id ?? "미연결"}</strong>
      </p>
      <form action={linkFileOrderIdAction} className="form" style={{ marginTop: 12 }}>
        <input name="file_id" type="hidden" value={file.id} />
        <div className="field">
          <label htmlFor="order_id">Cafe24 주문번호</label>
          <input
            id="order_id"
            name="order_id"
            placeholder="Cafe24 주문번호를 입력하세요. 예: 20260630-0000029"
            defaultValue={file.order_id ?? ""}
          />
        </div>
        <button className="button" type="submit">주문번호 연결</button>
      </form>
      {message ? <p style={{ marginBottom: 0 }}>{message}</p> : null}
    </div>
  );
}

function OrderFileResultCard({ file }: { file: UploadedFileRecord }) {
  return (
    <div className="notice" style={{ marginTop: 14 }}>
      <div className="grid grid-3">
        <FileLookupField label="original_filename" value={file.original_filename} />
        <FileLookupField label="file_id" value={file.id} />
        <FileLookupField label="product_no" value={file.product_no} />
        <FileLookupField label="file_size" value={file.file_size} />
        <FileLookupField label="mime_type" value={file.mime_type} />
        <FileLookupField label="status" value={file.status} />
        <FileLookupField label="storage_bucket" value={file.storage_bucket} />
        <FileLookupField label="storage_path" value={file.storage_path} />
        <FileLookupField label="created_at" value={file.created_at} />
        <FileLookupField label="updated_at" value={file.updated_at} />
      </div>
      <DownloadPanel file={file} />
    </div>
  );
}

function AdminConfigMissingPage() {
  const status = getAdminAuthConfigStatus();

  return (
    <main className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <p className="eyebrow">ADMIN</p>
        <h1>관리자 접근 설정이 필요합니다</h1>
        <p className="lead">
          관리자 화면을 사용하려면 Vercel 환경변수에 관리자 비밀번호와 세션 secret을 등록한 뒤 Production을 다시 배포해야 합니다.
        </p>
      </section>
      <section className="panel panel-pad">
        <h2>필요한 환경변수</h2>
        <div className="grid grid-2">
          <div className="card">
            <span>ADMIN_ACCESS_PASSWORD</span>
            <strong>{status.hasPassword ? "present" : "missing"}</strong>
          </div>
          <div className="card">
            <span>ADMIN_SESSION_SECRET</span>
            <strong>{status.hasSessionSecret ? "present" : "missing"}</strong>
          </div>
        </div>
        <p className="lead" style={{ marginTop: 16 }}>
          실제 비밀번호와 secret 값은 화면에 표시하지 않습니다.
        </p>
      </section>
    </main>
  );
}

function AdminLoginPage({ authMessage }: { authMessage: string }) {
  return (
    <main className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <p className="eyebrow">ADMIN</p>
        <h1>관리자 로그인</h1>
        <p className="lead">파일 조회와 다운로드는 관리자 비밀번호 확인 후 사용할 수 있습니다.</p>
      </section>
      <section className="panel panel-pad">
        <form action={loginAdminAction} className="form">
          <div className="field">
            <label htmlFor="password">관리자 비밀번호</label>
            <input id="password" name="password" type="password" autoComplete="current-password" />
          </div>
          <button className="button" type="submit">로그인</button>
        </form>
        {authMessage ? <div className="notice" style={{ marginTop: 16 }}>{authMessage}</div> : null}
      </section>
    </main>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const authStatus = getAdminAuthConfigStatus();
  if (!authStatus.isConfigured) {
    return <AdminConfigMissingPage />;
  }

  if (!isAdminAuthenticated()) {
    const auth = readParam(searchParams, "auth");
    const authMessage = auth === "failed" ? "비밀번호가 올바르지 않습니다." : "";
    return <AdminLoginPage authMessage={authMessage} />;
  }

  const fileIdQuery = readParam(searchParams, "file_id");
  const orderIdQuery = readParam(searchParams, "order_id");
  const orderLinkMessage = getOrderLinkMessage(readParam(searchParams, "order_link"));
  const data = await getAdminData(
    fileIdQuery,
    hasFileIdParam(searchParams),
    orderIdQuery,
    hasOrderIdParam(searchParams)
  );
  const isSupabaseConfigured = data.supabase.hasUrl && data.supabase.hasAnonKey && data.supabase.hasServiceRoleKey;

  return (
    <main className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <p className="eyebrow">ADMIN</p>
        <h1>Perpackage Cafe24 file upload admin</h1>
        <p className="lead">
          Phase 1 admin view checks connection status and uploaded file metadata. Tokens, storage secrets, and service
          role keys are never displayed.
        </p>
        <form action={logoutAdminAction}>
          <button className="button secondary" type="submit">로그아웃</button>
        </form>
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
        <h2>주문번호로 업로드 파일 찾기</h2>
        <p className="lead">
          Cafe24 주문번호를 입력하면 해당 주문번호에 연결된 업로드 파일 목록을 확인할 수 있습니다.
        </p>
        <form className="form" method="get" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="order_id_lookup">Cafe24 주문번호</label>
            <input
              id="order_id_lookup"
              name="order_id"
              placeholder="Cafe24 주문번호를 입력하세요. 예: 20260630-0000029"
              defaultValue={data.orderLookup.query}
            />
          </div>
          <button className="button" type="submit">주문번호로 파일 찾기</button>
        </form>

        {data.orderLookup.message ? (
          <div className="notice" style={{ marginTop: 16 }}>{data.orderLookup.message}</div>
        ) : null}

        {data.orderLookup.files.length ? (
          <div style={{ marginTop: 16 }}>
            <p className="lead">
              주문번호 {data.orderLookup.query}에 연결된 파일 {data.orderLookup.files.length}개
            </p>
            {data.orderLookup.files.map((file) => (
              <OrderFileResultCard key={file.id} file={file} />
            ))}
          </div>
        ) : null}
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
              <FileLookupField label="order_id" value={data.fileLookup.file.order_id} emptyText="미연결" />
              <FileLookupField label="inquiry_id" value={data.fileLookup.file.inquiry_id} emptyText="미연결" />
              <FileLookupField label="created_at" value={data.fileLookup.file.created_at} />
              <FileLookupField label="updated_at" value={data.fileLookup.file.updated_at} />
            </div>
            <OrderLinkPanel file={data.fileLookup.file} message={orderLinkMessage} />
            <DownloadPanel file={data.fileLookup.file} />
            <DownloadLogPanel logs={data.fileLookup.downloadLogs} />
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
