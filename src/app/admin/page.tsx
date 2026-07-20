import {
  linkCafe24LookupFileOrderIdAction,
  linkFileOrderIdAction,
  loginAdminAction,
  logoutAdminAction,
  updateProofConfirmationStatusAction
} from "@/app/admin/actions";
import { AdminDownloadLink, AdminRefreshButton } from "@/components/AdminDownloadLogRefreshControls";
import { AdminCafe24QuotePricePreflightPanel } from "@/components/AdminCafe24QuotePricePreflightPanel";
import { AdminFileStatusForm } from "@/components/AdminFileStatusForm";
import { CopyFileIdButton } from "@/components/CopyFileIdButton";
import { ProofConfirmationMessagePanel } from "@/components/ProofConfirmationMessagePanel";
import { ReuploadLinkCreatePanel } from "@/components/ReuploadLinkCreatePanel";
import { getAdminAuthConfigStatus, isAdminAuthenticated } from "@/lib/admin/auth";
import { getCafe24ConfigStatus } from "@/lib/cafe24/config";
import {
  fetchCafe24OrderLookup,
  formatCafe24OrderStatusCode,
  type Cafe24OrderLookupSummary
} from "@/lib/cafe24/order-lookup";
import { getCafe24Installation } from "@/lib/cafe24/token-store";
import {
  listRecentCafe24WebhookAttentionEvents,
  listRecentCafe24WebhookEvents,
  summarizeCafe24WebhookPayload,
  type Cafe24WebhookAttentionRecord,
  type Cafe24WebhookStatusFilter,
  type Cafe24WebhookProcessedStatus,
  type Cafe24WebhookEventRecord
} from "@/lib/cafe24/webhook-events";
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
import {
  getFileOrderLinkSourceLabel,
  listFileOrderLinkLogs,
  type FileOrderLinkLogRecord
} from "@/lib/files/order-link-log-service";
import {
  getProofStatusFilter,
  getProofStatusLabel,
  listProofConfirmations,
  listProofConfirmationsByFileId,
  type ProofConfirmationStatusFilter,
  type ProofConfirmationRecord
} from "@/lib/files/proof-confirmation-service";
import {
  listFileReuploadRequestsByOriginalFileId,
  listFileReuploadRequestsByNewFileId,
  listRecentReuploadReviewQueue,
  type ReuploadReviewQueueRecord,
  type FileReuploadRequestRecord
} from "@/lib/files/reupload-request-service";
import {
  isPendingReviewFileWorkItem,
  isReuploadReadyForReview,
  isUnlinkedFileWorkItem,
  isWebhookAttentionStatus
} from "@/lib/admin/admin-work-queue";
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
  cafe24Order: Cafe24OrderLookupSummary | null;
  cafe24OrderMessage: string | null;
  cafe24OrderStatus: "idle" | "found" | "not_linked" | "error";
  downloadLogs: FileDownloadLogRecord[];
  statusLogs: FileStatusChangeLogRecord[];
  orderLinkLogs: FileOrderLinkLogRecord[];
  proofConfirmations: ProofConfirmationRecord[];
  reuploadRequests: FileReuploadRequestRecord[];
  reuploadSourceRequests: FileReuploadRequestRecord[];
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

type Cafe24UploadFileMatchStatus = "linkable" | "already_linked" | "different_order" | "not_found";

type Cafe24UploadFileMatch = {
  fileId: string;
  file: UploadedFileRecord | null;
  status: Cafe24UploadFileMatchStatus;
};

type Cafe24OrderApiLookupState = {
  query: string;
  order: Cafe24OrderLookupSummary | null;
  fileMatches: Cafe24UploadFileMatch[];
  message: string | null;
  status: "idle" | "found" | "empty" | "error";
};

type AdminTodayQueueState = {
  unlinkedFiles: UploadedFileRecord[];
  pendingReviewFiles: UploadedFileRecord[];
  reuploadReviewRequests: ReuploadReviewQueueRecord[];
  webhookAttentionEvents: Cafe24WebhookAttentionRecord[];
  warnings: string[];
};

type AdminPageProps = {
  searchParams?: {
    auth?: string | string[];
    lookup?: string | string[];
    file_id?: string | string[];
    order_link?: string | string[];
    order_id?: string | string[];
    cafe24_order_id?: string | string[];
    cafe24_link?: string | string[];
    proof_action?: string | string[];
    recent_status?: string | string[];
    recent_order_link?: string | string[];
    download_file_id?: string | string[];
    download_order_id?: string | string[];
    download_result?: string | string[];
    download_start_date?: string | string[];
    download_end_date?: string | string[];
    webhook_status?: string | string[];
    proof_status?: string | string[];
    proof_file_id?: string | string[];
    proof_order_id?: string | string[];
    proof_start_date?: string | string[];
    proof_end_date?: string | string[];
    tab?: string | string[];
  };
};

function readParam(
  searchParams: AdminPageProps["searchParams"],
  key:
    | "auth"
    | "lookup"
    | "file_id"
    | "order_link"
    | "order_id"
    | "cafe24_order_id"
    | "cafe24_link"
    | "proof_action"
    | "recent_status"
    | "recent_order_link"
    | "download_file_id"
    | "download_order_id"
    | "download_result"
    | "download_start_date"
    | "download_end_date"
    | "webhook_status"
    | "proof_status"
    | "proof_file_id"
    | "proof_order_id"
    | "proof_start_date"
    | "proof_end_date"
    | "tab"
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

function isFileIdLookup(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function buildProofConfirmationLogExportHref({
  proofStatus,
  fileId,
  orderId,
  startDate,
  endDate
}: {
  proofStatus: ProofConfirmationStatusFilter;
  fileId: string;
  orderId: string;
  startDate: string;
  endDate: string;
}) {
  const params = new URLSearchParams();

  if (proofStatus !== "all") {
    params.set("proof_status", proofStatus);
  }

  if (fileId) {
    params.set("proof_file_id", fileId);
  }

  if (orderId) {
    params.set("proof_order_id", orderId);
  }

  if (startDate) {
    params.set("proof_start_date", startDate);
  }

  if (endDate) {
    params.set("proof_end_date", endDate);
  }

  const query = params.toString();
  return `/api/admin/proof-confirmations/export${query ? `?${query}` : ""}`;
}

function shortenUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return "-";
  }

  return userAgent.length > 90 ? `${userAgent.slice(0, 90)}...` : userAgent;
}

const WEBHOOK_STATUS_LABELS: Record<Cafe24WebhookProcessedStatus, string> = {
  received: "수신됨",
  auto_linked: "자동 연결 완료",
  already_linked: "이미 연결됨",
  no_order_id: "주문번호 없음",
  no_file_id: "업로드 파일 ID 없음",
  file_not_found: "업로드 파일 없음",
  conflict_order_id: "다른 주문번호 연결됨",
  failed: "처리 실패"
};

const WEBHOOK_STATUS_FILTER_OPTIONS: Array<{ value: Cafe24WebhookStatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "received", label: WEBHOOK_STATUS_LABELS.received },
  { value: "auto_linked", label: WEBHOOK_STATUS_LABELS.auto_linked },
  { value: "already_linked", label: WEBHOOK_STATUS_LABELS.already_linked },
  { value: "no_order_id", label: WEBHOOK_STATUS_LABELS.no_order_id },
  { value: "no_file_id", label: WEBHOOK_STATUS_LABELS.no_file_id },
  { value: "file_not_found", label: WEBHOOK_STATUS_LABELS.file_not_found },
  { value: "conflict_order_id", label: WEBHOOK_STATUS_LABELS.conflict_order_id },
  { value: "failed", label: WEBHOOK_STATUS_LABELS.failed }
];

const WEBHOOK_WARNING_STATUSES = new Set<Cafe24WebhookProcessedStatus>([
  "no_order_id",
  "no_file_id",
  "file_not_found",
  "conflict_order_id",
  "failed"
]);

const WEBHOOK_EVENT_TYPE_LABELS: Record<string, string> = {
  "order.received": "주문 접수",
  "order.updated": "주문 상태 변경",
  "order.created": "주문 생성",
  "deployment.check": "배포 확인",
  unknown: "알 수 없음"
};

function getWebhookStatusLabel(status: string) {
  return WEBHOOK_STATUS_LABELS[status as Cafe24WebhookProcessedStatus] ?? status;
}

function getWebhookStatusClassName(status: string) {
  if (WEBHOOK_WARNING_STATUSES.has(status as Cafe24WebhookProcessedStatus)) {
    return "status status-warning";
  }

  if (status === "auto_linked" || status === "already_linked") {
    return "status status-success";
  }

  return "status";
}

function getWebhookEventTypeLabel(eventType: string) {
  return WEBHOOK_EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function getWebhookStatusFilter(value: string): Cafe24WebhookStatusFilter {
  return WEBHOOK_STATUS_FILTER_OPTIONS.some((option) => option.value === value)
    ? (value as Cafe24WebhookStatusFilter)
    : "all";
}

const PROOF_STATUS_FILTER_OPTIONS: Array<{ value: ProofConfirmationStatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "requested", label: "교정확인 요청" },
  { value: "confirmed", label: "고객 확인 완료" },
  { value: "rejected", label: "고객 수정 요청" },
  { value: "canceled", label: "요청 취소" },
  { value: "skipped", label: "교정확인 생략" }
];

type AdminTab = "today" | "files" | "reupload" | "logs" | "settings";

const ADMIN_TAB_ITEMS: Array<{ value: AdminTab; label: string; description: string }> = [
  { value: "today", label: "오늘 처리", description: "최근 업로드와 오늘 확인할 작업" },
  { value: "files", label: "파일 찾기", description: "주문번호, file_id 검색과 파일 처리" },
  { value: "reupload", label: "재업로드", description: "재업로드 요청과 새 파일 확인" },
  { value: "logs", label: "로그 확인", description: "Webhook, 다운로드, 교정확인 이력" },
  { value: "settings", label: "설정", description: "앱 연동 상태와 OAuth 정보" }
];

function getAdminTab(value: string): AdminTab {
  return ADMIN_TAB_ITEMS.some((item) => item.value === value) ? (value as AdminTab) : "today";
}

function getProofStatusClassName(status: string) {
  if (status === "requested") {
    return "status status-warning";
  }

  if (status === "confirmed") {
    return "status status-success";
  }

  return "status";
}

type AdminPreservedQuery = {
  tab: AdminTab;
  fileId: string;
  orderId: string;
  cafe24OrderId: string;
  recentStatus: string;
  recentOrderLink: RecentFileOrderLinkFilter;
  downloadFileId: string;
  downloadOrderId: string;
  downloadResult: AdminDownloadLogResultFilter;
  downloadStartDate: string;
  downloadEndDate: string;
  webhookStatus: Cafe24WebhookStatusFilter;
  proofStatus: ProofConfirmationStatusFilter;
  proofFileId: string;
  proofOrderId: string;
  proofStartDate: string;
  proofEndDate: string;
};

function buildAdminHrefFromPreservedQuery(values: AdminPreservedQuery) {
  const params = new URLSearchParams();

  params.set("tab", values.tab);
  if (values.fileId) params.set("file_id", values.fileId);
  if (values.orderId) params.set("order_id", values.orderId);
  if (values.cafe24OrderId) params.set("cafe24_order_id", values.cafe24OrderId);
  if (values.recentStatus !== "all") params.set("recent_status", values.recentStatus);
  if (values.recentOrderLink !== "all") params.set("recent_order_link", values.recentOrderLink);
  if (values.downloadFileId) params.set("download_file_id", values.downloadFileId);
  if (values.downloadOrderId) params.set("download_order_id", values.downloadOrderId);
  if (values.downloadResult !== "all") params.set("download_result", values.downloadResult);
  if (values.downloadStartDate) params.set("download_start_date", values.downloadStartDate);
  if (values.downloadEndDate) params.set("download_end_date", values.downloadEndDate);
  if (values.webhookStatus !== "all") params.set("webhook_status", values.webhookStatus);
  if (values.proofStatus !== "all") params.set("proof_status", values.proofStatus);
  if (values.proofFileId) params.set("proof_file_id", values.proofFileId);
  if (values.proofOrderId) params.set("proof_order_id", values.proofOrderId);
  if (values.proofStartDate) params.set("proof_start_date", values.proofStartDate);
  if (values.proofEndDate) params.set("proof_end_date", values.proofEndDate);

  const query = params.toString();
  return `/admin${query ? `?${query}` : ""}`;
}

function AdminPreservedQueryInputs({
  values,
  omitWebhookFilter = false,
  omitProofFilters = false
}: {
  values: AdminPreservedQuery;
  omitWebhookFilter?: boolean;
  omitProofFilters?: boolean;
}) {
  return (
    <>
      <input name="tab" type="hidden" value={values.tab} />
      {values.fileId ? <input name="file_id" type="hidden" value={values.fileId} /> : null}
      {values.orderId ? <input name="order_id" type="hidden" value={values.orderId} /> : null}
      {values.cafe24OrderId ? <input name="cafe24_order_id" type="hidden" value={values.cafe24OrderId} /> : null}
      {values.recentStatus !== "all" ? <input name="recent_status" type="hidden" value={values.recentStatus} /> : null}
      {values.recentOrderLink !== "all" ? (
        <input name="recent_order_link" type="hidden" value={values.recentOrderLink} />
      ) : null}
      {values.downloadFileId ? <input name="download_file_id" type="hidden" value={values.downloadFileId} /> : null}
      {values.downloadOrderId ? <input name="download_order_id" type="hidden" value={values.downloadOrderId} /> : null}
      {values.downloadResult !== "all" ? <input name="download_result" type="hidden" value={values.downloadResult} /> : null}
      {values.downloadStartDate ? (
        <input name="download_start_date" type="hidden" value={values.downloadStartDate} />
      ) : null}
      {values.downloadEndDate ? <input name="download_end_date" type="hidden" value={values.downloadEndDate} /> : null}
      {!omitWebhookFilter && values.webhookStatus !== "all" ? (
        <input name="webhook_status" type="hidden" value={values.webhookStatus} />
      ) : null}
      {!omitProofFilters && values.proofStatus !== "all" ? (
        <input name="proof_status" type="hidden" value={values.proofStatus} />
      ) : null}
      {!omitProofFilters && values.proofFileId ? (
        <input name="proof_file_id" type="hidden" value={values.proofFileId} />
      ) : null}
      {!omitProofFilters && values.proofOrderId ? (
        <input name="proof_order_id" type="hidden" value={values.proofOrderId} />
      ) : null}
      {!omitProofFilters && values.proofStartDate ? (
        <input name="proof_start_date" type="hidden" value={values.proofStartDate} />
      ) : null}
      {!omitProofFilters && values.proofEndDate ? (
        <input name="proof_end_date" type="hidden" value={values.proofEndDate} />
      ) : null}
    </>
  );
}

function AdminWorkflowTabs({
  activeTab,
  fileId,
  orderId
}: {
  activeTab: AdminTab;
  fileId: string;
  orderId: string;
}) {
  return (
    <section className="panel panel-pad admin-tabs-panel" aria-labelledby="admin-workflow-tabs-title">
      <div>
        <p className="eyebrow">WORKFLOW</p>
        <h2 id="admin-workflow-tabs-title">관리자 업무 흐름</h2>
        <p className="lead">
          오늘 처리할 파일, 파일 검색, 재업로드, 로그 확인, 설정을 업무 흐름별로 나눠 확인합니다.
        </p>
      </div>
      <nav className="admin-tabs" aria-label="관리자 업무 탭">
        {ADMIN_TAB_ITEMS.map((item) => {
          const params = new URLSearchParams({ tab: item.value });
          if ((item.value === "files" || item.value === "reupload") && fileId) {
            params.set("file_id", fileId);
          } else if (item.value === "files" && orderId) {
            params.set("lookup", orderId);
          }
          const href = `/admin?${params.toString()}`;
          const isActive = item.value === activeTab;

          return (
            <a
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "admin-tab admin-tab-active" : "admin-tab"}
              href={href}
              key={item.value}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </a>
          );
        })}
      </nav>
    </section>
  );
}

function AdminTodayGuide() {
  const pendingHref = "/admin?tab=today&recent_status=uploaded_pending";
  const reuploadHref = "/admin?tab=reupload";
  const webhookAttentionHref = "/admin?tab=logs&webhook_status=failed";

  return (
    <section className="panel panel-pad" aria-labelledby="today-work-title">
      <h2 id="today-work-title">오늘 처리할 업무</h2>
      <p className="lead">
        최근 업로드 파일을 먼저 보고, 확인 전 파일과 재업로드 완료 파일, 주의가 필요한 Webhook 로그를 순서대로 확인합니다.
      </p>
      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <a className="card admin-action-card" href={pendingHref}>
          <span>확인 전 파일</span>
          <strong>업로드됨 / 확인 전</strong>
          <p>최근 업로드 목록을 확인 전 상태로 필터링합니다.</p>
        </a>
        <a className="card admin-action-card" href={reuploadHref}>
          <span>재업로드</span>
          <strong>재업로드 완료 파일 확인</strong>
          <p>재업로드 요청 이력과 새 파일 처리 버튼을 확인합니다.</p>
        </a>
        <a className="card admin-action-card" href={webhookAttentionHref}>
          <span>Webhook</span>
          <strong>확인 필요 로그</strong>
          <p>처리 실패 로그부터 확인해 주문 연결 문제를 점검합니다.</p>
        </a>
      </div>
    </section>
  );
}

function formatAdminDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function AdminTodayWorkQueue({ queue }: { queue: AdminTodayQueueState }) {
  const totalCount =
    queue.unlinkedFiles.length +
    queue.pendingReviewFiles.length +
    queue.reuploadReviewRequests.length +
    queue.webhookAttentionEvents.length;

  return (
    <section className="panel panel-pad" aria-labelledby="admin-today-queue-title">
      <div className="admin-work-queue-heading">
        <div>
          <p className="eyebrow">PRIORITY QUEUE</p>
          <h2 id="admin-today-queue-title">오늘 우선 처리 작업대</h2>
          <p className="lead">
            최근 항목을 운영 우선순위로 자동 분류합니다. 실제 연결, 검수 승인, 교체 처리는 상세 화면에서 확인 후 진행합니다.
          </p>
        </div>
        <strong className="admin-work-queue-total">{totalCount}건</strong>
      </div>

      {queue.warnings.length ? (
        <div className="notice" style={{ marginTop: 16 }}>
          일부 작업 목록을 불러오지 못했습니다: {queue.warnings.join(", ")}
        </div>
      ) : null}

      <div className="admin-work-summary" aria-label="오늘 처리 항목 요약">
        <div><span>주문 미연결</span><strong>{queue.unlinkedFiles.length}</strong></div>
        <div><span>파일 확인 전</span><strong>{queue.pendingReviewFiles.length}</strong></div>
        <div><span>재업로드 검수</span><strong>{queue.reuploadReviewRequests.length}</strong></div>
        <div><span>Webhook 확인</span><strong>{queue.webhookAttentionEvents.length}</strong></div>
      </div>

      <div className="admin-work-queue-groups">
        <section className="admin-work-queue-group" aria-labelledby="queue-unlinked-title">
          <div className="admin-work-queue-group-heading">
            <div>
              <h3 id="queue-unlinked-title">1. 주문번호 미연결</h3>
              <p>주문 완료 후에도 주문번호가 없는 최근 파일입니다.</p>
            </div>
            <a className="button secondary button-small" href="/admin?tab=today&recent_order_link=unlinked">전체 보기</a>
          </div>
          <ul className="admin-work-queue-list">
            {queue.unlinkedFiles.length ? queue.unlinkedFiles.map((file) => (
              <li key={file.id}>
                <div>
                  <strong>{file.original_filename}</strong>
                  <span>{formatAdminDateTime(file.created_at)} · {getFileStatusLabel(file.status)}</span>
                </div>
                <a className="button secondary button-small" href={`/admin?tab=files&file_id=${encodeURIComponent(file.id)}`}>
                  연결 확인
                </a>
              </li>
            )) : <li className="admin-work-queue-empty">확인할 미연결 파일이 없습니다.</li>}
          </ul>
        </section>

        <section className="admin-work-queue-group" aria-labelledby="queue-pending-title">
          <div className="admin-work-queue-group-heading">
            <div>
              <h3 id="queue-pending-title">2. 파일 확인 전</h3>
              <p>주문번호가 연결됐지만 아직 검수를 시작하지 않은 파일입니다.</p>
            </div>
            <a className="button secondary button-small" href="/admin?tab=today&recent_status=uploaded_pending&recent_order_link=linked">전체 보기</a>
          </div>
          <ul className="admin-work-queue-list">
            {queue.pendingReviewFiles.length ? queue.pendingReviewFiles.map((file) => (
              <li key={file.id}>
                <div>
                  <strong>{file.original_filename}</strong>
                  <span>{file.order_id ?? "주문번호 없음"} · {formatAdminDateTime(file.created_at)}</span>
                </div>
                <a className="button secondary button-small" href={`/admin?tab=files&file_id=${encodeURIComponent(file.id)}`}>
                  파일 검수
                </a>
              </li>
            )) : <li className="admin-work-queue-empty">새로 확인할 파일이 없습니다.</li>}
          </ul>
        </section>

        <section className="admin-work-queue-group" aria-labelledby="queue-reupload-title">
          <div className="admin-work-queue-group-heading">
            <div>
              <h3 id="queue-reupload-title">3. 재업로드 파일 검수</h3>
              <p>고객이 수정 파일을 올렸고 관리자 확인을 기다리는 요청입니다.</p>
            </div>
            <a className="button secondary button-small" href="/admin?tab=reupload">재업로드 탭</a>
          </div>
          <ul className="admin-work-queue-list">
            {queue.reuploadReviewRequests.length ? queue.reuploadReviewRequests.map((request) => (
              <li key={request.id}>
                <div>
                  <strong>{request.new_file.original_filename}</strong>
                  <span>
                    {request.order_id ?? "주문번호 미연결"} · {getFileStatusLabel(request.new_file.status)} · {formatAdminDateTime(request.updated_at)}
                  </span>
                </div>
                {request.new_file_id ? (
                  <a className="button secondary button-small" href={`/admin?tab=files&file_id=${encodeURIComponent(request.new_file_id)}`}>
                    새 파일 검수
                  </a>
                ) : null}
              </li>
            )) : <li className="admin-work-queue-empty">검수 대기 중인 재업로드 파일이 없습니다.</li>}
          </ul>
        </section>

        <section className="admin-work-queue-group" aria-labelledby="queue-webhook-title">
          <div className="admin-work-queue-group-heading">
            <div>
              <h3 id="queue-webhook-title">4. Webhook 확인 필요</h3>
              <p>정상 자동 연결 외 상태로 남은 최근 주문 이벤트입니다.</p>
            </div>
            <a className="button secondary button-small" href="/admin?tab=logs">로그 탭</a>
          </div>
          <ul className="admin-work-queue-list">
            {queue.webhookAttentionEvents.length ? queue.webhookAttentionEvents.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{getWebhookStatusLabel(event.processed_status)}</strong>
                  <span>{event.order_id ?? "주문번호 없음"} · {formatAdminDateTime(event.received_at)}</span>
                </div>
                <a className="button secondary button-small" href={`/admin?tab=logs&webhook_status=${encodeURIComponent(event.processed_status)}`}>
                  로그 확인
                </a>
              </li>
            )) : <li className="admin-work-queue-empty">확인 필요한 최근 Webhook이 없습니다.</li>}
          </ul>
        </section>
      </div>
    </section>
  );
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
    case "different_order":
      return "이미 다른 주문번호에 연결된 파일이라 변경하지 않았습니다. Cafe24 주문상세를 다시 확인해 주세요.";
    case "failed":
      return "주문번호 연결에 실패했습니다.";
    default:
      return "";
  }
}

function getCafe24AutoLinkMessage(status: string) {
  switch (status) {
    case "success":
      return "Cafe24 주문번호로 파일을 자동 연결했습니다.";
    case "already_linked":
      return "이미 이 주문번호에 연결되어 있습니다.";
    case "different_order":
      return "다른 주문번호에 연결된 파일이라 자동으로 덮어쓰지 않았습니다. 수동 확인이 필요합니다.";
    case "empty_order_id":
      return "Cafe24 주문번호를 확인할 수 없습니다.";
    case "missing_file_id":
      return "file_id를 확인할 수 없습니다.";
    case "file_not_found":
      return "Supabase files에서 해당 file_id를 찾지 못했습니다.";
    case "failed":
      return "Cafe24 주문번호 자동 연결에 실패했습니다.";
    default:
      return "";
  }
}

function getProofActionMessage(status: string) {
  switch (status) {
    case "request_saved":
      return "교정확인 요청 이력을 저장했습니다.";
    case "confirmed_saved":
      return "고객 확인 완료로 기록했습니다. 파일 상태는 자동으로 변경되지 않습니다.";
    case "rejected_saved":
      return "고객 수정 요청으로 기록했습니다. 필요하면 파일 상태를 별도로 변경해 주세요.";
    case "canceled_saved":
      return "교정확인 요청을 취소 처리했습니다.";
    case "empty_message":
      return "교정확인 안내문 내용을 확인할 수 없습니다.";
    case "missing_file_id":
      return "file_id를 확인할 수 없습니다.";
    case "missing_confirmation_id":
      return "교정확인 이력을 확인할 수 없습니다.";
    case "request_failed":
      return "교정확인 요청 이력 저장에 실패했습니다. DB 테이블 적용 여부를 확인해 주세요.";
    case "status_failed":
      return "교정확인 상태 기록에 실패했습니다. 이미 처리된 요청인지 확인해 주세요.";
    default:
      return "";
  }
}

async function lookupFileById(rawFileId: string, shouldSearch: boolean): Promise<FileLookupState> {
  const query = rawFileId.trim();

  if (!shouldSearch) {
    return {
      query: "",
      file: null,
      cafe24Order: null,
      cafe24OrderMessage: null,
      cafe24OrderStatus: "idle",
      downloadLogs: [],
      statusLogs: [],
      orderLinkLogs: [],
      proofConfirmations: [],
      reuploadRequests: [],
      reuploadSourceRequests: [],
      message: null,
      status: "idle"
    };
  }

  if (!query) {
    return {
      query: rawFileId,
      file: null,
      cafe24Order: null,
      cafe24OrderMessage: null,
      cafe24OrderStatus: "idle",
      downloadLogs: [],
      statusLogs: [],
      orderLinkLogs: [],
      proofConfirmations: [],
      reuploadRequests: [],
      reuploadSourceRequests: [],
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
        cafe24Order: null,
        cafe24OrderMessage: null,
        cafe24OrderStatus: "idle",
        downloadLogs: [],
        statusLogs: [],
        orderLinkLogs: [],
        proofConfirmations: [],
        reuploadRequests: [],
        reuploadSourceRequests: [],
        message: "해당 file_id의 업로드 파일을 찾지 못했습니다.",
        status: "not_found"
      };
    }

    let cafe24Order: Cafe24OrderLookupSummary | null = null;
    let cafe24OrderMessage: string | null = null;
    let cafe24OrderStatus: FileLookupState["cafe24OrderStatus"] = "not_linked";
    const linkedOrderId = file.order_id?.trim();

    if (linkedOrderId) {
      try {
        cafe24Order = await fetchCafe24OrderLookup(linkedOrderId);
        cafe24OrderStatus = "found";
      } catch {
        cafe24OrderMessage = "Cafe24 주문 정보를 불러오지 못했습니다. 설정 탭의 OAuth 상태를 확인해 주세요.";
        cafe24OrderStatus = "error";
      }
    }

    const [
      downloadLogs,
      statusLogs,
      orderLinkLogs,
      proofConfirmations,
      reuploadRequests,
      reuploadSourceRequests
    ] = await Promise.all([
      listFileDownloadLogs(file.id, 5),
      listFileStatusChangeLogs(file.id, 10),
      listFileOrderLinkLogs(file.id, 5),
      listProofConfirmationsByFileId(file.id, 10),
      listFileReuploadRequestsByOriginalFileId(file.id, 10),
      listFileReuploadRequestsByNewFileId(file.id, 10)
    ]);
    return {
      query,
      file,
      cafe24Order,
      cafe24OrderMessage,
      cafe24OrderStatus,
      downloadLogs,
      statusLogs,
      orderLinkLogs,
      proofConfirmations,
      reuploadRequests,
      reuploadSourceRequests,
      message: null,
      status: "found"
    };
  } catch (error) {
    return {
      query,
      file: null,
      cafe24Order: null,
      cafe24OrderMessage: null,
      cafe24OrderStatus: "idle",
      downloadLogs: [],
      statusLogs: [],
      orderLinkLogs: [],
      proofConfirmations: [],
      reuploadRequests: [],
      reuploadSourceRequests: [],
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
    return { query: "", order: null, fileMatches: [], message: null, status: "idle" };
  }

  if (!query) {
    return {
      query: rawOrderId,
      order: null,
      fileMatches: [],
      message: "Cafe24 주문번호를 입력해 주세요.",
      status: "empty"
    };
  }

  try {
    const order = await fetchCafe24OrderLookup(query);
    const fileMatches = await Promise.all(
      order.uploadFileIds.map(async (fileId): Promise<Cafe24UploadFileMatch> => {
        const file = await getFileById(fileId);
        if (!file) {
          return { fileId, file: null, status: "not_found" };
        }

        const currentOrderId = file.order_id?.trim() ?? "";
        if (currentOrderId === query) {
          return { fileId, file, status: "already_linked" };
        }

        if (currentOrderId) {
          return { fileId, file, status: "different_order" };
        }

        return { fileId, file, status: "linkable" };
      })
    );

    return { query, order, fileMatches, message: null, status: "found" };
  } catch (error) {
    return {
      query,
      order: null,
      fileMatches: [],
      message: error instanceof Error ? error.message : "Cafe24 주문 조회에 실패했습니다.",
      status: "error"
    };
  }
}

async function getAdminData(
  activeTab: AdminTab,
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
  downloadEndDateFilter: string,
  webhookStatusFilter: Cafe24WebhookStatusFilter,
  proofStatusFilter: ProofConfirmationStatusFilter,
  proofFileIdFilter: string,
  proofOrderIdFilter: string,
  proofStartDateFilter: string,
  proofEndDateFilter: string
) {
  const cafe24 = getCafe24ConfigStatus();
  const supabase = getSupabaseConfigStatus();
  const storage = getNaverStorageStatus();
  let installation = null;
  let files: UploadedFileRecord[] = [];
  let adminDownloadLogs: AdminDownloadLogRecord[] = [];
  let cafe24WebhookEvents: Cafe24WebhookEventRecord[] = [];
  let proofConfirmationLogs: ProofConfirmationRecord[] = [];
  let todayQueue: AdminTodayQueueState = {
    unlinkedFiles: [],
    pendingReviewFiles: [],
    reuploadReviewRequests: [],
    webhookAttentionEvents: [],
    warnings: []
  };
  let dataError = null;
  let fileLookup = await lookupFileById("", false);
  let orderLookup = await lookupFilesByOrderId("", false);
  let cafe24OrderLookup = await lookupCafe24OrderById("", false);

  if (activeTab === "files") {
    [fileLookup, orderLookup, cafe24OrderLookup] = await Promise.all([
      lookupFileById(fileIdQuery, shouldSearchFileId),
      lookupFilesByOrderId(orderIdQuery, shouldSearchOrderId),
      lookupCafe24OrderById(cafe24OrderIdQuery, shouldSearchCafe24OrderId)
    ]);
  }

  if (activeTab === "reupload") {
    fileLookup = await lookupFileById(fileIdQuery, shouldSearchFileId);
  }

  if (activeTab === "settings") {
    try {
      [installation, cafe24OrderLookup] = await Promise.all([
        getCafe24Installation(),
        lookupCafe24OrderById(cafe24OrderIdQuery, shouldSearchCafe24OrderId)
      ]);
    } catch (error) {
      dataError = error instanceof Error ? error.message : "Failed to load admin data.";
    }
  }

  if (activeTab === "today") {
    const [filesResult, unlinkedResult, pendingResult, reuploadResult, webhookResult] = await Promise.allSettled([
      listRecentFiles(20, {
        status: recentStatusFilter,
        orderLink: recentOrderLinkFilter
      }),
      listRecentFiles(10, { orderLink: "unlinked" }),
      listRecentFiles(10, { status: "uploaded_pending", orderLink: "linked" }),
      listRecentReuploadReviewQueue(10),
      listRecentCafe24WebhookAttentionEvents(10)
    ]);

    if (filesResult.status === "fulfilled") {
      files = filesResult.value;
    } else {
      dataError = filesResult.reason instanceof Error ? filesResult.reason.message : "Failed to load recent files.";
    }

    if (unlinkedResult.status === "fulfilled") {
      todayQueue.unlinkedFiles = unlinkedResult.value.filter(isUnlinkedFileWorkItem);
    } else {
      todayQueue.warnings.push("주문번호 미연결 파일");
    }

    if (pendingResult.status === "fulfilled") {
      todayQueue.pendingReviewFiles = pendingResult.value.filter(isPendingReviewFileWorkItem);
    } else {
      todayQueue.warnings.push("확인 전 파일");
    }

    if (reuploadResult.status === "fulfilled") {
      todayQueue.reuploadReviewRequests = reuploadResult.value.filter((request) =>
        isReuploadReadyForReview({
          status: request.status,
          new_file_id: request.new_file_id,
          new_file_status: request.new_file.status
        })
      );
    } else {
      todayQueue.warnings.push("재업로드 검수 대기");
    }

    if (webhookResult.status === "fulfilled") {
      todayQueue.webhookAttentionEvents = webhookResult.value.filter((event) =>
        isWebhookAttentionStatus(event.processed_status)
      );
    } else {
      todayQueue.warnings.push("Webhook 확인 필요");
    }
  }

  if (activeTab === "logs") {
    const [downloadLogsResult, webhookEventsResult, proofLogsResult] = await Promise.allSettled([
      listAdminDownloadLogs({
        fileId: downloadFileIdFilter,
        orderId: downloadOrderIdFilter,
        result: downloadResultFilter,
        startDate: downloadStartDateFilter,
        endDate: downloadEndDateFilter,
        limit: 50
      }),
      listRecentCafe24WebhookEvents(10, webhookStatusFilter),
      listProofConfirmations({
        proofStatus: proofStatusFilter,
        fileId: proofFileIdFilter,
        orderId: proofOrderIdFilter,
        startDate: proofStartDateFilter,
        endDate: proofEndDateFilter,
        limit: 10
      })
    ]);

    if (downloadLogsResult.status === "fulfilled") {
      adminDownloadLogs = downloadLogsResult.value;
    } else {
      dataError = downloadLogsResult.reason instanceof Error
        ? downloadLogsResult.reason.message
        : "Failed to load download logs.";
    }

    if (webhookEventsResult.status === "fulfilled") {
      cafe24WebhookEvents = webhookEventsResult.value;
    } else {
      dataError = dataError ?? (webhookEventsResult.reason instanceof Error
        ? webhookEventsResult.reason.message
        : "Failed to load Cafe24 webhook events.");
    }

    if (proofLogsResult.status === "fulfilled") {
      proofConfirmationLogs = proofLogsResult.value;
    } else {
      dataError = dataError ?? (proofLogsResult.reason instanceof Error
        ? proofLogsResult.reason.message
        : "Failed to load proof confirmation logs.");
    }
  }

  return {
    cafe24,
    supabase,
    storage,
    installation,
    files,
    adminDownloadLogs,
    cafe24WebhookEvents,
    proofConfirmationLogs,
    todayQueue,
    dataError,
    fileLookup,
    orderLookup,
    cafe24OrderLookup
  };
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
        <AdminDownloadLink
          className="button"
          href={`/api/files/download?file_id=${encodeURIComponent(file.id)}`}
        >
          파일 다운로드
        </AdminDownloadLink>
      ) : (
        <p style={{ marginBottom: 0 }}>다운로드에 필요한 저장소 정보가 아직 충분하지 않습니다.</p>
      )}
    </div>
  );
}

function ReuploadSourceNotice({ requests }: { requests: FileReuploadRequestRecord[] }) {
  if (!requests.length) {
    return null;
  }

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>재업로드 등록 파일</h3>
      <p>
        이 파일은 고객 재업로드 링크를 통해 새로 등록된 파일입니다. 원본 파일은 자동 삭제/자동 교체되지 않으며,
        기존 파일 상태 변경은 관리자가 직접 처리해야 합니다.
      </p>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>요청일시</th>
              <th>원본 파일 ID</th>
              <th>주문번호</th>
              <th>사유</th>
              <th>원본 파일 보기</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.created_at}</td>
                <td><code>{request.original_file_id}</code></td>
                <td>{formatEmpty(request.order_id, "미연결")}</td>
                <td>{formatEmpty(request.reason)}</td>
                <td>
                  <a
                    className="button secondary button-small"
                    href={`/admin?tab=files&file_id=${encodeURIComponent(request.original_file_id)}`}
                  >
                    원본 파일 상세 보기
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReuploadWorkflowPanel({
  lookup
}: {
  lookup: FileLookupState;
}) {
  const file = lookup.file;

  return (
    <section className="panel panel-pad" id="reupload-workflow">
      <h2>재업로드 처리</h2>
      <p className="lead">
        문제가 있는 파일의 file_id를 검색한 뒤 요청 생성, 고객 안내, 재업로드 이력을 한 곳에서 확인합니다.
      </p>
      <form className="form" method="get" style={{ marginTop: 16 }}>
        <input name="tab" type="hidden" value="reupload" />
        <div className="field">
          <label htmlFor="reupload_file_id">file_id</label>
          <input
            id="reupload_file_id"
            name="file_id"
            placeholder="재업로드를 요청하거나 확인할 file_id를 입력하세요."
            defaultValue={lookup.query}
          />
        </div>
        <button className="button" type="submit">재업로드 파일 찾기</button>
      </form>

      {lookup.message ? (
        <div className="notice" style={{ marginTop: 16 }}>{lookup.message}</div>
      ) : null}

      {file ? (
        <div style={{ marginTop: 16 }}>
          <div className="grid grid-3">
            <FileLookupField label="file_id" value={file.id} />
            <FileLookupField label="original_filename" value={file.original_filename} />
            <FileLookupField label="order_id" value={file.order_id} emptyText="미연결" />
            <FileLookupField label="status" value={file.status} />
            <FileLookupField label="created_at" value={file.created_at} />
            <FileLookupField label="updated_at" value={file.updated_at} />
          </div>
          <ReuploadSourceNotice requests={lookup.reuploadSourceRequests} />
          <ReuploadLinkCreatePanel
            fileId={file.id}
            initialRequests={lookup.reuploadRequests}
            orderId={file.order_id}
            originalFilename={file.original_filename}
          />
          <div className="notice" style={{ marginTop: 16 }}>
            새 파일을 다운로드하여 확인한 뒤, 필요하면 새 파일 상태를 직접 변경하세요. 기존 파일은 자동 삭제되거나
            자동으로 “새 파일로 교체됨” 처리되지 않습니다.
          </div>
        </div>
      ) : (
        <div className="notice" style={{ marginTop: 16 }}>
          file_id를 검색하면 통합 재업로드 요청 생성 영역이 표시됩니다.
        </div>
      )}
    </section>
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

function Cafe24WebhookEventsPanel({
  events,
  selectedStatus,
  preservedQuery
}: {
  events: Cafe24WebhookEventRecord[];
  selectedStatus: Cafe24WebhookStatusFilter;
  preservedQuery: AdminPreservedQuery;
}) {
  return (
    <section className="panel panel-pad" id="webhook-logs">
      <h2>Cafe24 Webhook 수신 로그</h2>
      <p className="lead">
        Cafe24 Webhook 요청이 실제로 들어오는지 확인하기 위한 최근 수신 로그입니다. payload 전체가 아니라 안전한 요약만 표시합니다.
      </p>
      <form className="form" method="get" style={{ marginTop: 16 }}>
        <AdminPreservedQueryInputs values={preservedQuery} omitWebhookFilter />
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="webhook_status">처리 상태 필터</label>
            <select id="webhook_status" name="webhook_status" defaultValue={selectedStatus}>
              {WEBHOOK_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>&nbsp;</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="button" type="submit">필터 적용</button>
              <a className="button secondary" href={buildAdminHrefFromPreservedQuery(preservedQuery)}>초기화</a>
            </div>
          </div>
        </div>
      </form>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>수신일시</th>
              <th>이벤트</th>
              <th>order_id</th>
              <th>처리 상태</th>
              <th>처리 메시지</th>
              <th>payload 요약</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? events.map((event) => {
              const summary = summarizeCafe24WebhookPayload(event.payload);
              const eventType = event.event_type || summary.eventType;
              return (
                <tr key={event.id}>
                  <td>{event.received_at}</td>
                  <td><span className="status">{getWebhookEventTypeLabel(eventType)}</span></td>
                  <td>{event.order_id ?? summary.orderId ?? "-"}</td>
                  <td>
                    <span className={getWebhookStatusClassName(event.processed_status)}>
                      {getWebhookStatusLabel(event.processed_status)}
                    </span>
                  </td>
                  <td className="webhook-error-message">{event.error_message ?? "-"}</td>
                  <td>
                    <div>top-level keys: {summary.topLevelKeys.join(", ") || "-"}</div>
                    <div>mall_id: {event.mall_id ?? summary.mallId ?? "-"}</div>
                    <div>order_id 후보: {summary.orderId ?? "-"}</div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6}>아직 수신된 Cafe24 Webhook 로그가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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

const RESPONSE_CHANNEL_OPTIONS = ["채널톡", "카카오톡", "이메일", "전화", "기타"];

function formatSelectedProofItems(items: string[] | null) {
  if (!items?.length) {
    return "-";
  }

  return items.join(", ");
}

function summarizeProofText(value: string | null, maxLength = 80) {
  if (!value) {
    return "-";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function getProofResponseSummary(log: ProofConfirmationRecord) {
  return summarizeProofText(log.reject_reason || log.customer_response, 80);
}

function ProofConfirmationHistoryPanel({ logs }: { logs: ProofConfirmationRecord[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3>교정확인 이력</h3>
      <p>
        고객 확인 완료, 수정 요청, 요청 취소는 내부 기록만 저장합니다. 이 작업은 파일 상태를 자동으로 변경하지 않습니다.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>요청일시</th>
              <th>상태</th>
              <th>선택 항목</th>
              <th>추가 메모</th>
              <th>회신 채널</th>
              <th>고객 회신/수정 요청</th>
              <th>처리자</th>
              <th>기록</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((log) => {
              const isRequested = log.proof_status === "requested";
              const responseText = log.reject_reason || log.customer_response || "-";

              return (
                <tr key={log.id}>
                  <td>{log.requested_at ?? log.created_at}</td>
                  <td><span className="status">{getProofStatusLabel(log.proof_status)}</span></td>
                  <td>{formatSelectedProofItems(log.selected_items)}</td>
                  <td>{log.extra_memo ?? "-"}</td>
                  <td>{log.response_channel ?? "-"}</td>
                  <td>{responseText}</td>
                  <td>{log.confirmed_by ?? log.requested_by ?? "admin"}</td>
                  <td>
                    {isRequested ? (
                      <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
                        <form action={updateProofConfirmationStatusAction} className="form">
                          <input name="file_id" type="hidden" value={log.file_id} />
                          <input name="confirmation_id" type="hidden" value={log.id} />
                          <input name="proof_status" type="hidden" value="confirmed" />
                          <div className="field">
                            <label htmlFor={`confirmed_channel_${log.id}`}>회신 채널</label>
                            <select id={`confirmed_channel_${log.id}`} name="response_channel" defaultValue="채널톡">
                              {RESPONSE_CHANNEL_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`confirmed_response_${log.id}`}>고객 회신 메모</label>
                            <textarea
                              id={`confirmed_response_${log.id}`}
                              name="customer_response"
                              placeholder="예: 고객이 확인했습니다라고 회신"
                              rows={2}
                            />
                          </div>
                          <button className="button secondary button-small" type="submit">
                            고객 확인 완료 기록
                          </button>
                        </form>
                        <form action={updateProofConfirmationStatusAction} className="form">
                          <input name="file_id" type="hidden" value={log.file_id} />
                          <input name="confirmation_id" type="hidden" value={log.id} />
                          <input name="proof_status" type="hidden" value="rejected" />
                          <div className="field">
                            <label htmlFor={`rejected_channel_${log.id}`}>회신 채널</label>
                            <select id={`rejected_channel_${log.id}`} name="response_channel" defaultValue="채널톡">
                              {RESPONSE_CHANNEL_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`reject_reason_${log.id}`}>수정 요청 메모</label>
                            <textarea
                              id={`reject_reason_${log.id}`}
                              name="reject_reason"
                              placeholder="예: 로고 위치 수정 요청"
                              rows={2}
                            />
                          </div>
                          <button className="button secondary button-small" type="submit">
                            고객 수정 요청 기록
                          </button>
                        </form>
                        <form action={updateProofConfirmationStatusAction}>
                          <input name="file_id" type="hidden" value={log.file_id} />
                          <input name="confirmation_id" type="hidden" value={log.id} />
                          <input name="proof_status" type="hidden" value="canceled" />
                          <button className="button secondary button-small" type="submit">
                            요청 취소
                          </button>
                        </form>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={8}>아직 교정확인 이력이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminProofConfirmationLogPanel({
  logs,
  proofStatus,
  proofFileId,
  proofOrderId,
  proofStartDate,
  proofEndDate,
  exportHref,
  preservedQuery
}: {
  logs: ProofConfirmationRecord[];
  proofStatus: ProofConfirmationStatusFilter;
  proofFileId: string;
  proofOrderId: string;
  proofStartDate: string;
  proofEndDate: string;
  exportHref: string;
  preservedQuery: AdminPreservedQuery;
}) {
  const resetHref = buildAdminHrefFromPreservedQuery({
    ...preservedQuery,
    proofStatus: "all",
    proofFileId: "",
    proofOrderId: "",
    proofStartDate: "",
    proofEndDate: ""
  });

  return (
    <section className="panel panel-pad" id="proof-confirmation-logs">
      <h2>전체 교정확인 이력</h2>
      <p className="lead">
        관리자가 저장한 교정확인 요청, 고객 확인 완료, 고객 수정 요청, 요청 취소 이력을 최근 순으로 확인할 수 있습니다.
      </p>
      <p>
        교정확인 요청 상태는 고객 회신 대기 건입니다. 파일 상태는 이 목록에서 자동으로 변경하지 않습니다.
      </p>

      <form className="form" method="get" style={{ marginTop: 16, marginBottom: 16 }}>
        <AdminPreservedQueryInputs values={preservedQuery} omitProofFilters />
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="proof_status">proof_status</label>
            <select id="proof_status" name="proof_status" defaultValue={proofStatus}>
              {PROOF_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="proof_file_id">file_id</label>
            <input
              id="proof_file_id"
              name="proof_file_id"
              placeholder="file_id 전체 또는 일부를 입력하세요"
              defaultValue={proofFileId}
            />
          </div>
          <div className="field">
            <label htmlFor="proof_order_id">Cafe24 주문번호</label>
            <input
              id="proof_order_id"
              name="proof_order_id"
              placeholder="Cafe24 주문번호를 입력하세요"
              defaultValue={proofOrderId}
            />
          </div>
          <div className="field">
            <label htmlFor="proof_start_date">시작일</label>
            <input
              id="proof_start_date"
              name="proof_start_date"
              type="date"
              defaultValue={proofStartDate}
            />
          </div>
          <div className="field">
            <label htmlFor="proof_end_date">종료일</label>
            <input
              id="proof_end_date"
              name="proof_end_date"
              type="date"
              defaultValue={proofEndDate}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" type="submit">필터 적용</button>
          <a className="button secondary" href={resetHref}>초기화</a>
          <a className="button secondary" href={exportHref}>CSV 다운로드</a>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>요청일시</th>
              <th>상태</th>
              <th>Cafe24 주문번호</th>
              <th>file_id</th>
              <th>선택 항목</th>
              <th>추가 메모</th>
              <th>회신 채널</th>
              <th>고객 회신/수정 요청</th>
              <th>처리자</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((log) => (
              <tr key={log.id}>
                <td>{log.requested_at ?? log.created_at}</td>
                <td>
                  <span className={getProofStatusClassName(log.proof_status)}>
                    {getProofStatusLabel(log.proof_status)}
                  </span>
                </td>
                <td>{log.order_id ?? "미연결"}</td>
                <td><CopyFileIdButton fileId={log.file_id} /></td>
                <td>{formatSelectedProofItems(log.selected_items)}</td>
                <td>{summarizeProofText(log.extra_memo, 80)}</td>
                <td>{log.response_channel ?? "-"}</td>
                <td>{getProofResponseSummary(log)}</td>
                <td>{log.confirmed_by ?? log.requested_by ?? "admin"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9}>조건에 맞는 교정확인 이력이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderLinkLogPanel({ logs }: { logs: FileOrderLinkLogRecord[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3>주문번호 연결 이력</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>연결일시</th>
              <th>이전 주문번호</th>
              <th>새 주문번호</th>
              <th>연결 방식</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((log) => (
              <tr key={log.id}>
                <td>{log.created_at}</td>
                <td>{log.previous_order_id ?? "미연결"}</td>
                <td>{log.new_order_id}</td>
                <td><span className="status">{getFileOrderLinkSourceLabel(log.link_source)}</span></td>
                <td>{log.memo ?? "-"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>아직 주문번호 연결 이력이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getCafe24UploadFileMatchMessage(match: Cafe24UploadFileMatch) {
  if (match.status === "linkable") {
    return "이 주문번호로 자동 연결할 수 있습니다.";
  }

  if (match.status === "already_linked") {
    return "이미 이 주문번호에 연결되어 있습니다.";
  }

  if (match.status === "different_order") {
    return `다른 주문번호(${match.file?.order_id ?? "-"})에 연결되어 있어 수동 확인이 필요합니다.`;
  }

  return "Supabase files에서 해당 파일을 찾지 못했습니다.";
}

function getOrderFilePosition(file: UploadedFileRecord, index: number) {
  if (file.status === "need_reupload") {
    return {
      label: "재업로드 요청",
      tone: "warning" as const
    };
  }

  if (file.status === "replaced") {
    return {
      label: "새 파일로 교체됨",
      tone: "previous" as const
    };
  }

  if (file.status === "archived") {
    return {
      label: "보관 처리",
      tone: "archived" as const
    };
  }

  return index === 0
    ? {
      label: "최신 파일",
      tone: "current" as const
    }
    : {
      label: "이전 파일",
      tone: "previous" as const
    };
}

function Cafe24OrderFileMatchPanel({
  lookup,
  linkMessage
}: {
  lookup: Cafe24OrderApiLookupState;
  linkMessage: string;
}) {
  const orderId = lookup.order?.orderId ?? lookup.order?.orderNo ?? lookup.query;

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Supabase files 매칭 결과</h3>
      {linkMessage ? <p>{linkMessage}</p> : null}
      {lookup.order?.uploadFileIds.length ? (
        <div className="grid" style={{ gap: 12 }}>
          {lookup.fileMatches.map((match) => (
            <div className="card" key={match.fileId}>
              <div className="grid grid-3">
                <FileLookupField label="file_id" value={match.fileId} />
                <FileLookupField label="Supabase files 매칭 여부" value={match.file ? "예" : "아니오"} />
                <FileLookupField label="original_filename" value={match.file?.original_filename ?? null} />
                <FileLookupField label="현재 연결된 주문번호" value={match.file?.order_id ?? null} emptyText="미연결" />
                <FileLookupField label="status" value={match.file?.status ?? null} />
                <FileLookupField label="created_at" value={match.file?.created_at ?? null} />
              </div>
              <p style={{ marginBottom: match.status === "linkable" ? 12 : 0 }}>
                {getCafe24UploadFileMatchMessage(match)}
              </p>
              {match.status === "linkable" ? (
                <form action={linkCafe24LookupFileOrderIdAction}>
                  <input name="file_id" type="hidden" value={match.fileId} />
                  <input name="order_id" type="hidden" value={orderId} />
                  <button className="button" type="submit">이 주문번호로 파일 자동 연결</button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ marginBottom: 0 }}>Cafe24 주문 품목에서 업로드 파일 ID를 찾지 못했습니다.</p>
      )}
    </div>
  );
}

function getCafe24ItemLookupStatusLabel(status: Cafe24OrderLookupSummary["responseShape"]["itemLookupStatus"]) {
  switch (status) {
    case "success":
      return "품목 조회 성공";
    case "failed":
      return "품목 조회 실패";
    case "not_attempted":
      return "품목 조회 안 함";
    default:
      return status;
  }
}

function Cafe24FileOrderInfoPanel({
  file,
  order,
  message,
  status
}: {
  file: UploadedFileRecord;
  order: Cafe24OrderLookupSummary | null;
  message: string | null;
  status: FileLookupState["cafe24OrderStatus"];
}) {
  if (!file.order_id) {
    return (
      <div className="notice" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Cafe24 주문 정보</h3>
        <p style={{ marginBottom: 0 }}>주문번호가 연결된 후 Cafe24 주문 정보를 확인할 수 있습니다.</p>
      </div>
    );
  }

  if (status === "error" || !order) {
    return (
      <div className="notice" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Cafe24 주문 정보</h3>
        <p style={{ marginBottom: 0 }}>
          {message ?? "Cafe24 주문 정보를 불러오지 못했습니다. 설정 탭의 OAuth 상태를 확인해 주세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="notice" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Cafe24 주문 정보</h3>
      <p>
        주문번호에 연결된 Cafe24 주문의 상품/옵션 요약입니다. 주문자명, 연락처, 이메일, 배송지 주소는 표시하지 않습니다.
      </p>
      <div className="grid grid-3">
        <FileLookupField label="Cafe24 주문번호" value={order.orderId ?? file.order_id} />
        <FileLookupField label="order_no" value={order.orderNo} />
        <FileLookupField label="주문일" value={order.orderedAt} />
        <FileLookupField label="주문상태" value={order.orderStatus} />
        <FileLookupField label="조회 상태" value="조회 성공" />
        <FileLookupField label="주문 품목 수" value={order.responseShape.itemCount} />
        <FileLookupField
          label="품목 조회 상태"
          value={getCafe24ItemLookupStatusLabel(order.responseShape.itemLookupStatus)}
        />
        <FileLookupField label="업로드 파일 ID 발견 수" value={order.uploadFileIds.length} />
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>주문에서 확인된 업로드 파일 ID</h4>
        {order.uploadFileIds.length ? (
          <ul style={{ marginBottom: 0 }}>
            {order.uploadFileIds.map((fileId) => (
              <li key={fileId}><CopyFileIdButton fileId={fileId} /></li>
            ))}
          </ul>
        ) : (
          <p style={{ marginBottom: 0 }}>주문 품목에서 업로드 파일 ID를 찾지 못했습니다.</p>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h4 style={{ marginBottom: 8 }}>상품/옵션 요약</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>상품명</th>
                <th>상품번호</th>
                <th>variant code</th>
                <th>품목 수량</th>
                <th>품목 상태</th>
                <th>상품 옵션</th>
                <th>추가 입력 옵션</th>
                <th>업로드 파일 ID</th>
              </tr>
            </thead>
            <tbody>
              {order.items.length ? order.items.map((item, index) => (
                <tr key={`${item.productNo ?? "item"}-${index}`}>
                  <td>{formatEmpty(item.productName)}</td>
                  <td>{formatEmpty(item.productNo)}</td>
                  <td>{formatEmpty(item.variantCode)}</td>
                  <td>{formatEmpty(item.quantity)}</td>
                  <td>{formatEmpty(formatCafe24OrderStatusCode(item.itemOrderStatus))}</td>
                  <td>{formatEmpty(item.optionText)}</td>
                  <td>{formatEmpty(item.additionalOptionText)}</td>
                  <td>
                    {item.uploadFileIds.length ? item.uploadFileIds.map((fileId) => (
                      <div key={fileId}><CopyFileIdButton fileId={fileId} /></div>
                    )) : "-"}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8}>Cafe24 주문 품목 요약을 찾지 못했습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Cafe24OrderApiLookupPanel({
  lookup,
  linkMessage
}: {
  lookup: Cafe24OrderApiLookupState;
  linkMessage: string;
}) {
  return (
    <section className="panel panel-pad" id="cafe24-order-test">
      <h2>Cafe24 주문 연동 확인</h2>
      <p className="lead">
        통합 검색에서 입력한 주문번호를 Cafe24 Admin API로 조회해 주문 옵션의 업로드 파일 ID와 저장 파일을 비교합니다.
      </p>

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

          <Cafe24OrderFileMatchPanel lookup={lookup} linkMessage={linkMessage} />

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

        </div>
      ) : null}
    </section>
  );
}

function Cafe24ApiDiagnosticsPanel({ lookup }: { lookup: Cafe24OrderApiLookupState }) {
  return (
    <section className="panel panel-pad" id="cafe24-api-diagnostics">
      <h2>Cafe24 API 진단</h2>
      <p className="lead">운영 처리 화면과 분리한 개발·연동 점검용 정보입니다.</p>
      <form className="form" method="get" style={{ marginTop: 16 }}>
        <input name="tab" type="hidden" value="settings" />
        <div className="field">
          <label htmlFor="cafe24_diagnostics_order_id">Cafe24 주문번호</label>
          <input
            id="cafe24_diagnostics_order_id"
            name="cafe24_order_id"
            placeholder="예: 20260701-0000017"
            defaultValue={lookup.query}
          />
        </div>
        <button className="button secondary" type="submit">진단 조회</button>
      </form>
      {lookup.message ? <div className="notice" style={{ marginTop: 16 }}>{lookup.message}</div> : null}
      {lookup.order ? (
        <details className="notice" open style={{ marginTop: 16 }}>
          <summary>응답 구조 요약</summary>
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
        </details>
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
  statusLogs,
  positionLabel,
  positionTone
}: {
  file: UploadedFileRecord;
  statusLogs: FileStatusChangeLogRecord[];
  positionLabel: string;
  positionTone: "current" | "previous" | "warning" | "archived";
}) {
  const positionClassName = positionTone === "current"
    ? "status status-success"
    : positionTone === "warning"
      ? "status status-warning"
      : "status";

  return (
    <div className="notice" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span className={positionClassName}>{positionLabel}</span>
        <span className="status">{getFileStatusLabel(file.status)}</span>
      </div>
      <div className="grid grid-3">
        <FileLookupField label="original_filename" value={file.original_filename} />
        <FileLookupField label="file_id" value={file.id} />
        <FileLookupField label="product_no" value={file.product_no} />
        <FileLookupField label="file_size" value={file.file_size} />
        <FileLookupField label="mime_type" value={file.mime_type} />
        <FileLookupField label="status" value={file.status} />
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

  const unifiedLookupQuery = readParam(searchParams, "lookup").trim();
  const unifiedFileIdQuery = unifiedLookupQuery && isFileIdLookup(unifiedLookupQuery) ? unifiedLookupQuery : "";
  const unifiedOrderIdQuery = unifiedLookupQuery && !unifiedFileIdQuery ? unifiedLookupQuery : "";
  const fileIdQuery = readParam(searchParams, "file_id") || unifiedFileIdQuery;
  const orderIdQuery = readParam(searchParams, "order_id") || unifiedOrderIdQuery;
  const cafe24OrderIdQuery = readParam(searchParams, "cafe24_order_id") || unifiedOrderIdQuery;
  const recentStatusFilter = getRecentStatusFilter(readParam(searchParams, "recent_status"));
  const recentOrderLinkFilter = getRecentOrderLinkFilter(readParam(searchParams, "recent_order_link"));
  const downloadFileIdFilter = readParam(searchParams, "download_file_id").trim();
  const downloadOrderIdFilter = readParam(searchParams, "download_order_id").trim();
  const downloadResultFilter = getDownloadResultFilter(readParam(searchParams, "download_result"));
  const downloadStartDateFilter = readParam(searchParams, "download_start_date").trim();
  const downloadEndDateFilter = readParam(searchParams, "download_end_date").trim();
  const webhookStatusFilter = getWebhookStatusFilter(readParam(searchParams, "webhook_status"));
  const proofStatusFilter = getProofStatusFilter(readParam(searchParams, "proof_status"));
  const proofFileIdFilter = readParam(searchParams, "proof_file_id").trim();
  const proofOrderIdFilter = readParam(searchParams, "proof_order_id").trim();
  const proofStartDateFilter = readParam(searchParams, "proof_start_date").trim();
  const proofEndDateFilter = readParam(searchParams, "proof_end_date").trim();
  const activeTab = getAdminTab(readParam(searchParams, "tab"));
  const preservedQuery: AdminPreservedQuery = {
    tab: activeTab,
    fileId: fileIdQuery,
    orderId: orderIdQuery,
    cafe24OrderId: cafe24OrderIdQuery,
    recentStatus: recentStatusFilter,
    recentOrderLink: recentOrderLinkFilter,
    downloadFileId: downloadFileIdFilter,
    downloadOrderId: downloadOrderIdFilter,
    downloadResult: downloadResultFilter,
    downloadStartDate: downloadStartDateFilter,
    downloadEndDate: downloadEndDateFilter,
    webhookStatus: webhookStatusFilter,
    proofStatus: proofStatusFilter,
    proofFileId: proofFileIdFilter,
    proofOrderId: proofOrderIdFilter,
    proofStartDate: proofStartDateFilter,
    proofEndDate: proofEndDateFilter
  };
  const downloadLogsExportHref = buildDownloadLogExportHref({
    fileId: downloadFileIdFilter,
    orderId: downloadOrderIdFilter,
    result: downloadResultFilter,
    startDate: downloadStartDateFilter,
    endDate: downloadEndDateFilter
  });
  const proofConfirmationLogsExportHref = buildProofConfirmationLogExportHref({
    proofStatus: proofStatusFilter,
    fileId: proofFileIdFilter,
    orderId: proofOrderIdFilter,
    startDate: proofStartDateFilter,
    endDate: proofEndDateFilter
  });
  const orderLinkMessage = getOrderLinkMessage(readParam(searchParams, "order_link"));
  const cafe24AutoLinkMessage = getCafe24AutoLinkMessage(readParam(searchParams, "cafe24_link"));
  const proofActionMessage = getProofActionMessage(readParam(searchParams, "proof_action"));
  const data = await getAdminData(
    activeTab,
    fileIdQuery,
    hasFileIdParam(searchParams) || Boolean(unifiedFileIdQuery),
    orderIdQuery,
    hasOrderIdParam(searchParams) || Boolean(unifiedOrderIdQuery),
    cafe24OrderIdQuery,
    hasCafe24OrderIdParam(searchParams) || Boolean(unifiedOrderIdQuery),
    recentStatusFilter,
    recentOrderLinkFilter,
    downloadFileIdFilter,
    downloadOrderIdFilter,
    downloadResultFilter,
    downloadStartDateFilter,
    downloadEndDateFilter,
    webhookStatusFilter,
    proofStatusFilter,
    proofFileIdFilter,
    proofOrderIdFilter,
    proofStartDateFilter,
    proofEndDateFilter
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

      <AdminWorkflowTabs
        activeTab={activeTab}
        fileId={fileIdQuery}
        orderId={orderIdQuery || cafe24OrderIdQuery}
      />

      {activeTab === "settings" ? (
        <>
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
      <AdminCafe24QuotePricePreflightPanel />
      <Cafe24ApiDiagnosticsPanel lookup={data.cafe24OrderLookup} />
        </>
      ) : null}

      {activeTab === "today" ? (
        <>
          <AdminTodayGuide />
          <AdminTodayWorkQueue queue={data.todayQueue} />
        </>
      ) : null}

      {activeTab === "files" ? (
        <>
      <section className="panel panel-pad" id="admin-unified-file-search">
        <h2>주문·파일 통합 검색</h2>
        <p className="lead">
          Cafe24 주문번호 또는 전체 file_id를 입력하면 연결된 주문, 저장 파일, 처리 이력을 함께 확인합니다.
        </p>
        <form className="form" method="get" style={{ marginTop: 16 }}>
          <input name="tab" type="hidden" value="files" />
          <div className="field">
            <label htmlFor="admin_lookup">Cafe24 주문번호 또는 file_id</label>
            <input
              id="admin_lookup"
              name="lookup"
              placeholder="예: 20260701-0000017 또는 전체 UUID"
              defaultValue={unifiedLookupQuery || fileIdQuery || orderIdQuery || cafe24OrderIdQuery}
            />
          </div>
          <button className="button" type="submit">통합 검색</button>
        </form>
      </section>

      <Cafe24OrderApiLookupPanel lookup={data.cafe24OrderLookup} linkMessage={cafe24AutoLinkMessage} />

      <section className="panel panel-pad" id="find-files-by-order">
        <h2>주문번호에 연결된 파일</h2>
        <p className="lead">
          통합 검색한 주문번호에 연결된 업로드 파일 목록입니다.
        </p>

        {data.orderLookup.message ? (
          <div className="notice" style={{ marginTop: 16 }}>{data.orderLookup.message}</div>
        ) : null}

        {data.orderLookup.files.length ? (
          <div style={{ marginTop: 16 }}>
            <p className="lead">
              주문번호 {data.orderLookup.query}에 연결된 파일 {data.orderLookup.files.length}개
            </p>
            <p>
              같은 주문번호의 파일은 업로드 일시 기준 최신순으로 표시합니다. 첫 번째 파일은 최신 파일로 보고,
              새 파일로 교체됨 또는 보관 처리 상태는 이전/보관 파일로 구분합니다.
            </p>
            {data.orderLookup.files.map((file, index) => {
              const position = getOrderFilePosition(file, index);

              return (
                <OrderFileResultCard
                  key={file.id}
                  file={file}
                  positionLabel={position.label}
                  positionTone={position.tone}
                  statusLogs={data.orderLookup.statusLogMap[file.id] ?? []}
                />
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="panel panel-pad" id="find-file-by-id">
        <h2>파일 상세 처리</h2>
        <p className="lead">
          통합 검색한 file_id의 파일 정보와 상태, 재업로드, 교정확인, 다운로드 이력을 처리합니다.
        </p>

        {data.fileLookup.message ? (
          <div className="notice" style={{ marginTop: 16 }}>{data.fileLookup.message}</div>
        ) : null}

        {data.fileLookup.file ? (
          <div style={{ marginTop: 16 }}>
            <div className="grid grid-3">
              <FileLookupField label="file_id" value={data.fileLookup.file.id} />
              <FileLookupField label="original_filename" value={data.fileLookup.file.original_filename} />
              <FileLookupField label="product_no" value={data.fileLookup.file.product_no} />
              <FileLookupField label="variant_code" value={data.fileLookup.file.variant_code} />
              <FileLookupField label="customer_type" value={data.fileLookup.file.customer_type} />
              <FileLookupField label="file_size" value={data.fileLookup.file.file_size} />
              <FileLookupField label="mime_type" value={data.fileLookup.file.mime_type} />
              <FileLookupField label="status" value={data.fileLookup.file.status} />
              <FileLookupField label="order_id" value={data.fileLookup.file.order_id} emptyText="미연결" />
              <FileLookupField label="created_at" value={data.fileLookup.file.created_at} />
              <FileLookupField label="updated_at" value={data.fileLookup.file.updated_at} />
            </div>
            <Cafe24FileOrderInfoPanel
              file={data.fileLookup.file}
              message={data.fileLookup.cafe24OrderMessage}
              order={data.fileLookup.cafe24Order}
              status={data.fileLookup.cafe24OrderStatus}
            />
            <ReuploadSourceNotice requests={data.fileLookup.reuploadSourceRequests} />
            <OrderLinkPanel file={data.fileLookup.file} message={orderLinkMessage} />
            <OrderLinkLogPanel logs={data.fileLookup.orderLinkLogs} />
            <AdminFileStatusForm fileId={data.fileLookup.file.id} currentStatus={data.fileLookup.file.status} />
            <ReuploadLinkCreatePanel
              fileId={data.fileLookup.file.id}
              initialRequests={data.fileLookup.reuploadRequests}
              orderId={data.fileLookup.file.order_id}
              originalFilename={data.fileLookup.file.original_filename}
            />
            <ProofConfirmationMessagePanel
              actionMessage={proofActionMessage}
              fileId={data.fileLookup.file.id}
              orderId={data.fileLookup.file.order_id}
              originalFilename={data.fileLookup.file.original_filename}
            />
            <ProofConfirmationHistoryPanel logs={data.fileLookup.proofConfirmations} />
            <StatusChangeLogPanel logs={data.fileLookup.statusLogs} />
            <DownloadPanel file={data.fileLookup.file} />
            <DownloadLogPanel logs={data.fileLookup.downloadLogs} />
          </div>
        ) : null}
      </section>

        </>
      ) : null}

      {activeTab === "reupload" ? (
        <ReuploadWorkflowPanel lookup={data.fileLookup} />
      ) : null}

      {activeTab === "today" ? (
      <section className="panel panel-pad" id="recent-files">
        <h2>최근 업로드 파일</h2>
        <p className="lead">
          최근 고객이 업로드한 파일을 빠르게 확인하는 요약 목록입니다. 상태 변경은 상세 보기에서 처리합니다.
        </p>
        <form className="form" method="get" style={{ marginTop: 16, marginBottom: 16 }}>
          <input name="tab" type="hidden" value="today" />
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
                <a className="button secondary" href="/admin?tab=today">초기화</a>
              </div>
            </div>
          </div>
        </form>
        <div className="table-wrap recent-files-table-wrap">
          <table className="recent-files-summary-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>file_id</th>
                <th>Cafe24 주문번호</th>
                <th>상태</th>
                <th>업로드일</th>
                <th>다운로드</th>
                <th>상세 보기</th>
              </tr>
            </thead>
            <tbody>
              {data.files.length ? data.files.map((file) => (
                <tr key={file.id}>
                  <td>{file.original_filename}</td>
                  <td><CopyFileIdButton fileId={file.id} /></td>
                  <td>{file.order_id ?? "미연결"}</td>
                  <td><span className="status">{getFileStatusLabel(file.status)}</span></td>
                  <td>{file.created_at}</td>
                  <td>
                    <AdminDownloadLink
                      className="button secondary button-small"
                      href={`/api/files/download?file_id=${encodeURIComponent(file.id)}`}
                    >
                      다운로드
                    </AdminDownloadLink>
                  </td>
                  <td>
                    <a
                      className="button secondary button-small"
                      href={`/admin?tab=files&file_id=${encodeURIComponent(file.id)}`}
                    >
                      상세 보기
                    </a>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>최근 업로드 파일이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      ) : null}

      {activeTab === "logs" ? (
        <>
      <Cafe24WebhookEventsPanel
        events={data.cafe24WebhookEvents}
        selectedStatus={webhookStatusFilter}
        preservedQuery={preservedQuery}
      />

      <AdminProofConfirmationLogPanel
        logs={data.proofConfirmationLogs}
        proofStatus={proofStatusFilter}
        proofFileId={proofFileIdFilter}
        proofOrderId={proofOrderIdFilter}
        proofStartDate={proofStartDateFilter}
        proofEndDate={proofEndDateFilter}
        exportHref={proofConfirmationLogsExportHref}
        preservedQuery={preservedQuery}
      />

      <section className="panel panel-pad" id="download-logs">
        <h2>전체 다운로드 로그</h2>
        <p className="lead">
          관리자가 파일을 다운로드한 이력을 최근 순으로 확인할 수 있습니다. file_id, Cafe24 주문번호, 결과 기준으로 필터링할 수 있습니다.
        </p>
        <form className="form" method="get" style={{ marginTop: 16, marginBottom: 16 }}>
          <input name="tab" type="hidden" value="logs" />
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
            <AdminRefreshButton />
            <a className="button secondary" href="/admin?tab=logs">초기화</a>
            <a className="button secondary" href={downloadLogsExportHref}>CSV 다운로드</a>
          </div>
        </form>
        <AdminDownloadLogTable logs={data.adminDownloadLogs} />
      </section>
        </>
      ) : null}
    </main>
  );
}
