import { linkFileOrderIdAction, loginAdminAction, logoutAdminAction } from "@/app/admin/actions";
import { AdminFileStatusForm } from "@/components/AdminFileStatusForm";
import { CopyFileIdButton } from "@/components/CopyFileIdButton";
import { getAdminAuthConfigStatus, isAdminAuthenticated } from "@/lib/admin/auth";
import { getCafe24ConfigStatus } from "@/lib/cafe24/config";
import { fetchCafe24OrderLookup, type Cafe24OrderLookupSummary } from "@/lib/cafe24/order-lookup";
import { getCafe24Installation } from "@/lib/cafe24/token-store";
import {
  listAdminDownloadLogs,
  listFileDownloadLogs,
  type AdminDownloadLogRecord,
  type AdminDownloadLogResultFilter,
  type FileDownloadLogRecord
} from "@/lib/files/download-log-service";
import {
  listFileStatusChangeLogs,
  type FileStatusChangeLogRecord
} from "@/lib/files/file-review-log-service";
import { FILE_STATUS_OPTIONS, getFileStatusLabel, isKnownFileStatus } from "@/lib/files/file-status";
import {
  getFileById,
  listFilesByOrderId,
  listRecentFiles,
  type RecentFileOrderLinkFilter
} from "@/lib/files/file-service";
import type { UploadedFileRecord } from "@/lib/files/types";
import { getSupabaseConfigStatus } from "@/lib/supabase/admin";
import { getNaverStorageStatus } from "@/lib/storage/naver-object-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FileLookupState = {
  query: string;
  file: UploadedFileRecord | null;
  downloadLogs: FileDownloadLogRecord[];
  statusLogs: FileStatusChangeLogRecord[];
  message: string | null;
  status: "idle" | "found" | "not_found" | "empty" | "error";
};

type OrderLookupState = {
  query: string;
  files: UploadedFileRecord[];
  statusLogMap: Record<string, FileStatusChangeLogRecord[]>;
  message: string | null;
  status: "idle" | "found" | "not_found" | "empty" | "error";
};

type Cafe24OrderApiLookupState = {
  query: string;
  order: Cafe24OrderLookupSummary | null;
  message: string | null;
  status: "idle" | "found" | "empty" | "error";
};

type AdminPageProps = {
  searchParams?: {
    auth?: string | string[];
    file_id?: string | string[];
    order_link?: string | string[];
    order_id?: string | string[];
    cafe24_order_id?: string | string[];
    recent_status?: string | string[];
    recent_order_link?: string | string[];
    download_file_id?: string | string[];
    download_order_id?: string | string[];
    download_result?: string | string[];
    download_start_date?: string | string[];
    download_end_date?: string | string[];
  };
};

function readParam(
  searchParams: AdminPageProps["searchParams"],
  key:
    | "auth"
    | "file_id"
    | "order_link"
    | "order_id"
    | "cafe24_order_id"
    | "recent_status"
    | "recent_order_link"
    | "download_file_id"
    | "download_order_id"
    | "download_result"
    | "download_start_date"
    | "download_end_date"
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function hasFileIdParam(searchParams?: AdminPageProps["searchParams"]) {
  return Boolean(searchParams && Object.prototype.hasOwnProperty.call(searchParams, "file_id"));
}

function hasOrderIdParam(searchParams?: AdminPageProps["searchParams"]) {
  return Boolean(searchParams && Object.prototype.hasOwnProperty.call(searchParams, "order_id"));
}

function hasCafe24OrderIdParam(searchParams?: AdminPageProps["searchParams"]) {
  return Boolean(searchParams && Object.prototype.hasOwnProperty.call(searchParams, "cafe24_order_id"));
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

function getRecentStatusFilter(value: string) {
  return isKnownFileStatus(value) ? value : "all";
}

function getRecentOrderLinkFilter(value: string): RecentFileOrderLinkFilter {
  return value === "linked" || value === "unlinked" ? value : "all";
}

function getDownloadResultFilter(value: string): AdminDownloadLogResultFilter {
  return value === "success" || value === "failed" ? value : "all";
}

function buildDownloadLogExportHref({
  fileId,
  orderId,
  result,
  startDate,
  endDate
}: {
  fileId: string;
  orderId: string;
  result: AdminDownloadLogResultFilter;
  startDate: string;
  endDate: string;
}) {
  const params = new URLSearchParams();

  if (fileId) {
    params.set("download_file_id", fileId);
  }

  if (orderId) {
    params.set("download_order_id", orderId);
  }

  if (result !== "all") {
    params.set("download_result", result);
  }

  if (startDate) {
    params.set("download_start_date", startDate);
  }

  if (endDate) {
    params.set("download_end_date", endDate);
  }

  const query = params.toString();
  return `/api/admin/download-logs/export${query ? `?${query}` : ""}`;
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
    return { query: "", file: null, downloadLogs: [], statusLogs: [], message: null, status: "idle" };
  }

  if (!query) {
    return {
      query: rawFileId,
      file: null,
      downloadLogs: [],
      statusLogs: [],
      message: "file_id를 입력해 주세요.",
      status: "empty"
    };
  }

  try {
    const file = await getFileById(query);

    if (!file) {
      return {
        query,
        file: null,
        downloadLogs: [],
        statusLogs: [],
        message: "해당 file_id의 업로드 파일을 찾지 못했습니다.",
        status: "not_found"
      };
    }

    const [downloadLogs, statusLogs] = await Promise.all([
      listFileDownloadLogs(file.id, 5),
      listFileStatusChangeLogs(file.id, 10)
    ]);
    return { query, file, downloadLogs, statusLogs, message: null, status: "found" };
  } catch (error) {
    return {
      query,
      file: null,
      downloadLogs: [],
      statusLogs: [],
      message: error instanceof Error ? error.message : "파일 조회에 실패했습니다.",
      status: "error"
    };
  }
}

async function lookupFilesByOrderId(rawOrderId: string, shouldSearch: boolean): Promise<OrderLookupState> {
  const query = rawOrderId.trim();

  if (!shouldSearch) {
    return { query: "", files: [], statusLogMap: {}, message: null, status: "idle" };
  }

  if (!query) {
    return {
      query: rawOrderId,
      files: [],
      statusLogMap: {},
      message: "주문번호를 입력해 주세요.",
      status: "empty"
    };
  }

  try {
    const files = await listFilesByOrderId(query);

    if (!files.length) {
      return {
        query,
        files: [],
        statusLogMap: {},
        message: "해당 주문번호에 연결된 업로드 파일이 없습니다.",
        status: "not_found"
      };
    }

    const statusLogEntries = await Promise.all(
      files.map(async (file) => [file.id, await listFileStatusChangeLogs(file.id, 3)] as const)
    );
    const statusLogMap = Object.fromEntries(statusLogEntries);

    return { query, files, statusLogMap, message: null, status: "found" };
  } catch (error) {
    return {
      query,
      files: [],
      statusLogMap: {},
      message: error instanceof Error ? error.message : "주문번호 기준 파일 조회에 실패했습니다.",
      status: "error"
    };
  }
}

async function lookupCafe24OrderById(rawOrderId: string, shouldSearch: boolean): Promise<Cafe24OrderApiLookupState> {
  const query = rawOrderId.trim();

  if (!shouldSearch) {
    return { query: "", order: null, message: null, status: "idle" };
  }

  if (!query) {
    return {
      query: rawOrderId,
      order: null,
      message: "Cafe24 주문번호를 입력해 주세요.",
      status: "empty"
    };
  }

  try {
    const order = await fetchCafe24OrderLookup(query);
    return { query, order, message: null, status: "found" };
  } catch (error) {
    return {
      query,
      order: null,
      message: error instanceof Error ? error.message : "Cafe24 주문 조회에 실패했습니다.",
      status: "error"
    };
  }
}

async function getAdminData(
  fileIdQuery: string,
  shouldSearchFileId: boolean,
  orderIdQuery: string,
  shouldSearchOrderId: boolean,
  cafe24OrderIdQuery: string,
  shouldSearchCafe24OrderId: boolean,
  recentStatusFilter: string,
  recentOrderLinkFilter: RecentFileOrderLinkFilter,
  downloadFileIdFilter: string,
  downloadOrderIdFilter: string,
  downloadResultFilter: AdminDownloadLogResultFilter,
  downloadStartDateFilter: string,
  downloadEndDateFilter: string
) {
  const cafe24 = getCafe24ConfigStatus();
  const supabase = getSupabaseConfigStatus();
  const storage = getNaverStorageStatus();
  let installation = null;
  let files: UploadedFileRecord[] = [];
  let adminDownloadLogs: AdminDownloadLogRecord[] = [];
  let dataError = null;
  const [fileLookup, orderLookup] = await Promise.all([
    lookupFileById(fileIdQuery, shouldSearchFileId),
    lookupFilesByOrderId(orderIdQuery, shouldSearchOrderId)
  ]);
  const cafe24OrderLookup = await lookupCafe24OrderById(cafe24OrderIdQuery, shouldSearchCafe24OrderId);

  try {
    installation = await getCafe24Installation();
  } catch (error) {
    dataError = error instanceof Error ? error.message : "Failed to load admin data.";
  }

  try {
    files = await listRecentFiles(20, {
      status: recentStatusFilter,
      orderLink: recentOrderLinkFilter
    });
  } catch (error) {
    dataError = dataError ?? (error instanceof Error ? error.message : "Failed to load recent files.");
  }

  try {
    adminDownloadLogs = await listAdminDownloadLogs({
      fileId: downloadFileIdFilter,
      orderId: downloadOrderIdFilter,
      result: downloadResultFilter,
      startDate: downloadStartDateFilter,
      endDate: downloadEndDateFilter,
      limit: 50
    });
  } catch (error) {
    dataError = dataError ?? (error instanceof Error ? error.message : "Failed to load download logs.");
  }

  return { cafe24, supabase, storage, installation, files, adminDownloadLogs, dataError, fileLookup, orderLookup, cafe24OrderLookup };
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
  const formattedValue =
    label === "file_size" && typeof value === "number"
      ? formatBytes(value)
      : label === "status"
        ? getFileStatusLabel(typeof value === "string" ? value : null)
        : formatEmpty(value, emptyText);

  return (
    <div className="card">
      <span>{label}</span>
      <strong>{formattedValue}</strong>
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

function AdminDownloadLogTable({ logs }: { logs: AdminDownloadLogRecord[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>다운로드 일시</th>
            <th>파일명</th>
            <th>file_id</th>
            <th>Cafe24 주문번호</th>
            <th>결과</th>
            <th>IP 주소</th>
            <th>브라우저</th>
            <th>오류 메시지</th>
          </tr>
        </thead>
        <tbody>
          {logs.length ? logs.map((log) => (
            <tr key={log.id}>
              <td>{log.downloaded_at}</td>
              <td>{log.original_filename ?? "-"}</td>
              <td>{log.file_id ? <CopyFileIdButton fileId={log.file_id} /> : "-"}</td>
              <td>{log.order_id ?? "미연결"}</td>
              <td><span className="status">{log.result}</span></td>
              <td>{log.ip_address ?? "-"}</td>
              <td>{shortenUserAgent(log.user_agent)}</td>
              <td>{log.error_message ?? "-"}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={8}>조건에 맞는 다운로드 로그가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusChangeLogPanel({ logs }: { logs: FileStatusChangeLogRecord[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3>상태 변경 이력</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>변경일시</th>
              <th>이전 상태</th>
              <th>변경 상태</th>
              <th>메모</th>
              <th>처리자</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((log) => (
              <tr key={log.id}>
                <td>{log.created_at}</td>
                <td>{getFileStatusLabel(log.previous_status)}</td>
                <td><span className="status">{getFileStatusLabel(log.new_status)}</span></td>
                <td>{log.memo ?? "-"}</td>
                <td>{log.admin_user ?? "admin"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>아직 상태 변경 이력이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cafe24OrderApiLookupPanel({ lookup }: { lookup: Cafe24OrderApiLookupState }) {
  return (
    <section className="panel panel-pad">
      <h2>Cafe24 주문 조회 테스트</h2>
      <p className="lead">
        Cafe24 Admin API로 주문 상세를 조회해 상품 옵션 안의 업로드 파일 ID가 API 응답에 포함되는지 확인합니다.
        이 기능은 조회 테스트 전용이며 Supabase files.order_id를 자동 업데이트하지 않습니다.
      </p>
      <form className="form" method="get" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="cafe24_order_id_lookup">Cafe24 주문번호</label>
          <input
            id="cafe24_order_id_lookup"
            name="cafe24_order_id"
            placeholder="Cafe24 주문번호를 입력하세요. 예: 20260701-0000017"
            defaultValue={lookup.query}
          />
        </div>
        <button className="button" type="submit">Cafe24 주문 조회</button>
      </form>

      {lookup.message ? (
        <div className="notice" style={{ marginTop: 16 }}>{lookup.message}</div>
      ) : null}

      {lookup.order ? (
        <div style={{ marginTop: 16 }}>
          <div className="grid grid-3">
            <FileLookupField label="tokenLookupMallId" value={lookup.order.tokenLookupMallId} />
            <FileLookupField label="order_id" value={lookup.order.orderId} />
            <FileLookupField label="order_no" value={lookup.order.orderNo} />
            <FileLookupField label="주문일" value={lookup.order.orderedAt} />
            <FileLookupField label="주문 상태" value={lookup.order.orderStatus} />
            <FileLookupField label="업로드 파일 ID 발견 수" value={lookup.order.uploadFileIds.length} />
          </div>

          <div className="notice" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>업로드 파일 ID</h3>
            {lookup.order.uploadFileIds.length ? (
              <ul style={{ marginBottom: 0 }}>
                {lookup.order.uploadFileIds.map((fileId) => (
                  <li key={fileId}><CopyFileIdButton fileId={fileId} /></li>
                ))}
              </ul>
            ) : (
              <p style={{ marginBottom: 0 }}>주문 상품 옵션에서 업로드 파일 ID를 찾지 못했습니다.</p>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <h3>상품/옵션 요약</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>상품명</th>
                    <th>상품번호</th>
                    <th>variant_code</th>
                    <th>상품 옵션</th>
                    <th>추가 입력 옵션</th>
                    <th>업로드 파일 ID</th>
                    <th>source</th>
                  </tr>
                </thead>
                <tbody>
                  {lookup.order.items.length ? lookup.order.items.map((item, index) => (
                    <tr key={`${item.productNo ?? "item"}-${index}`}>
                      <td>{item.productName ?? "-"}</td>
                      <td>{item.productNo ?? "-"}</td>
                      <td>{item.variantCode ?? "-"}</td>
                      <td>{item.optionText ?? "-"}</td>
                      <td>{item.additionalOptionText ?? "-"}</td>
                      <td>
                        {item.uploadFileIds.length ? item.uploadFileIds.map((fileId) => (
                          <div key={fileId}><CopyFileIdButton fileId={fileId} /></div>
                        )) : "-"}
                      </td>
                      <td>{item.uploadFileIdSources.join(", ") || "-"}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7}>Cafe24 API 응답에서 상품 item 목록을 찾지 못했습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="notice" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>응답 구조 요약</h3>
            <p>order detail top-level keys: {lookup.order.responseShape.detailTopLevelKeys.join(", ") || "-"}</p>
            <p>order item response top-level keys: {lookup.order.responseShape.itemResponseTopLevelKeys.join(", ") || "-"}</p>
            <p>order object: {lookup.order.responseShape.hasOrderObject ? "있음" : "없음"}</p>
            <p>orders array: {lookup.order.responseShape.hasOrdersArray ? "있음" : "없음"}</p>
            <p>order detail item count: {lookup.order.responseShape.detailItemCount}</p>
            <p>order item array: {lookup.order.responseShape.itemArrayExists ? "있음" : "없음"}</p>
            <p>order item count: {lookup.order.responseShape.itemCount}</p>
            <p>item lookup status: {lookup.order.responseShape.itemLookupStatus}</p>
            <p style={{ marginBottom: 0 }}>
              item lookup error: {lookup.order.responseShape.itemLookupErrorMessage ?? "-"}
            </p>
          </div>
        </div>
      ) : null}
    </section>
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

function OrderFileResultCard({
  file,
  statusLogs
}: {
  file: UploadedFileRecord;
  statusLogs: FileStatusChangeLogRecord[];
}) {
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
      <AdminFileStatusForm fileId={file.id} currentStatus={file.status} />
      <StatusChangeLogPanel logs={statusLogs} />
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
  const cafe24OrderIdQuery = readParam(searchParams, "cafe24_order_id");
  const recentStatusFilter = getRecentStatusFilter(readParam(searchParams, "recent_status"));
  const recentOrderLinkFilter = getRecentOrderLinkFilter(readParam(searchParams, "recent_order_link"));
  const downloadFileIdFilter = readParam(searchParams, "download_file_id").trim();
  const downloadOrderIdFilter = readParam(searchParams, "download_order_id").trim();
  const downloadResultFilter = getDownloadResultFilter(readParam(searchParams, "download_result"));
  const downloadStartDateFilter = readParam(searchParams, "download_start_date").trim();
  const downloadEndDateFilter = readParam(searchParams, "download_end_date").trim();
  const downloadLogsExportHref = buildDownloadLogExportHref({
    fileId: downloadFileIdFilter,
    orderId: downloadOrderIdFilter,
    result: downloadResultFilter,
    startDate: downloadStartDateFilter,
    endDate: downloadEndDateFilter
  });
  const orderLinkMessage = getOrderLinkMessage(readParam(searchParams, "order_link"));
  const data = await getAdminData(
    fileIdQuery,
    hasFileIdParam(searchParams),
    orderIdQuery,
    hasOrderIdParam(searchParams),
    cafe24OrderIdQuery,
    hasCafe24OrderIdParam(searchParams),
    recentStatusFilter,
    recentOrderLinkFilter,
    downloadFileIdFilter,
    downloadOrderIdFilter,
    downloadResultFilter,
    downloadStartDateFilter,
    downloadEndDateFilter
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

      <Cafe24OrderApiLookupPanel lookup={data.cafe24OrderLookup} />

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
              <OrderFileResultCard
                key={file.id}
                file={file}
                statusLogs={data.orderLookup.statusLogMap[file.id] ?? []}
              />
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
            <AdminFileStatusForm fileId={data.fileLookup.file.id} currentStatus={data.fileLookup.file.status} />
            <StatusChangeLogPanel logs={data.fileLookup.statusLogs} />
            <DownloadPanel file={data.fileLookup.file} />
            <DownloadLogPanel logs={data.fileLookup.downloadLogs} />
          </div>
        ) : null}
      </section>

      <section className="panel panel-pad">
        <h2>최근 업로드 파일</h2>
        <p className="lead">
          최근 고객이 업로드한 파일 목록입니다. 파일을 다운로드하거나 상태를 변경할 수 있습니다.
        </p>
        <form className="form" method="get" style={{ marginTop: 16, marginBottom: 16 }}>
          {fileIdQuery ? <input name="file_id" type="hidden" value={fileIdQuery} /> : null}
          {orderIdQuery ? <input name="order_id" type="hidden" value={orderIdQuery} /> : null}
          {downloadFileIdFilter ? <input name="download_file_id" type="hidden" value={downloadFileIdFilter} /> : null}
          {downloadOrderIdFilter ? <input name="download_order_id" type="hidden" value={downloadOrderIdFilter} /> : null}
          {downloadResultFilter !== "all" ? <input name="download_result" type="hidden" value={downloadResultFilter} /> : null}
          {downloadStartDateFilter ? (
            <input name="download_start_date" type="hidden" value={downloadStartDateFilter} />
          ) : null}
          {downloadEndDateFilter ? (
            <input name="download_end_date" type="hidden" value={downloadEndDateFilter} />
          ) : null}
          <div className="grid grid-3">
            <div className="field">
              <label htmlFor="recent_status">상태</label>
              <select id="recent_status" name="recent_status" defaultValue={recentStatusFilter}>
                <option value="all">전체</option>
                {FILE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="recent_order_link">주문번호</label>
              <select id="recent_order_link" name="recent_order_link" defaultValue={recentOrderLinkFilter}>
                <option value="all">전체</option>
                <option value="linked">주문번호 연결됨</option>
                <option value="unlinked">주문번호 미연결</option>
              </select>
            </div>
            <div className="field">
              <span>&nbsp;</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="button" type="submit">필터 적용</button>
                <a className="button secondary" href="/admin">초기화</a>
              </div>
            </div>
          </div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File name</th>
                <th>file_id</th>
                <th>Cafe24 주문번호</th>
                <th>mall/product</th>
                <th>Size</th>
                <th>MIME</th>
                <th>Status</th>
                <th>Uploaded at</th>
                <th>Download</th>
                <th>상태 변경</th>
              </tr>
            </thead>
            <tbody>
              {data.files.length ? data.files.map((file) => (
                <tr key={file.id}>
                  <td>{file.original_filename}</td>
                  <td><CopyFileIdButton fileId={file.id} /></td>
                  <td>{file.order_id ?? "미연결"}</td>
                  <td>{file.mall_id ?? "-"} / {file.product_no ?? "-"}</td>
                  <td>{file.file_size.toLocaleString()} bytes</td>
                  <td>{file.mime_type}</td>
                  <td><span className="status">{getFileStatusLabel(file.status)}</span></td>
                  <td>{file.created_at}</td>
                  <td>
                    <a
                      className="button secondary button-small"
                      href={`/api/files/download?file_id=${encodeURIComponent(file.id)}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      다운로드
                    </a>
                  </td>
                  <td>
                    <AdminFileStatusForm fileId={file.id} currentStatus={file.status} variant="compact" />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10}>최근 업로드 파일이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel-pad">
        <h2>전체 다운로드 로그</h2>
        <p className="lead">
          관리자가 파일을 다운로드한 이력을 최근 순으로 확인할 수 있습니다. file_id, Cafe24 주문번호, 결과 기준으로 필터링할 수 있습니다.
        </p>
        <form className="form" method="get" style={{ marginTop: 16, marginBottom: 16 }}>
          {fileIdQuery ? <input name="file_id" type="hidden" value={fileIdQuery} /> : null}
          {orderIdQuery ? <input name="order_id" type="hidden" value={orderIdQuery} /> : null}
          {recentStatusFilter !== "all" ? <input name="recent_status" type="hidden" value={recentStatusFilter} /> : null}
          {recentOrderLinkFilter !== "all" ? (
            <input name="recent_order_link" type="hidden" value={recentOrderLinkFilter} />
          ) : null}
          <div className="grid grid-3">
            <div className="field">
              <label htmlFor="download_file_id">file_id</label>
              <input
                id="download_file_id"
                name="download_file_id"
                placeholder="file_id 전체 또는 일부를 입력하세요"
                defaultValue={downloadFileIdFilter}
              />
            </div>
            <div className="field">
              <label htmlFor="download_order_id">Cafe24 주문번호</label>
              <input
                id="download_order_id"
                name="download_order_id"
                placeholder="Cafe24 주문번호를 입력하세요. 예: 20260630-0000029"
                defaultValue={downloadOrderIdFilter}
              />
            </div>
            <div className="field">
              <label htmlFor="download_result">결과</label>
              <select id="download_result" name="download_result" defaultValue={downloadResultFilter}>
                <option value="all">전체</option>
                <option value="success">성공</option>
                <option value="failed">실패</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="download_start_date">시작일</label>
              <input
                id="download_start_date"
                name="download_start_date"
                type="date"
                defaultValue={downloadStartDateFilter}
              />
            </div>
            <div className="field">
              <label htmlFor="download_end_date">종료일</label>
              <input
                id="download_end_date"
                name="download_end_date"
                type="date"
                defaultValue={downloadEndDateFilter}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" type="submit">필터 적용</button>
            <a className="button secondary" href="/admin">초기화</a>
            <a className="button secondary" href={downloadLogsExportHref}>CSV 다운로드</a>
          </div>
        </form>
        <AdminDownloadLogTable logs={data.adminDownloadLogs} />
      </section>
    </main>
  );
}
