import {
  linkCafe24LookupFileOrderIdAction,
  linkFileOrderIdAction,
  loginAdminAction,
  logoutAdminAction,
  updateProofConfirmationStatusAction
} from "@/app/admin/actions";
import { AdminDownloadLink, AdminRefreshButton } from "@/components/AdminDownloadLogRefreshControls";
import { AdminFileStatusForm } from "@/components/AdminFileStatusForm";
import { CopyFileIdButton } from "@/components/CopyFileIdButton";
import { ProofConfirmationMessagePanel } from "@/components/ProofConfirmationMessagePanel";
import { ReuploadRequestMessagePanel } from "@/components/ReuploadRequestMessagePanel";
import { getAdminAuthConfigStatus, isAdminAuthenticated } from "@/lib/admin/auth";
import { getCafe24ConfigStatus } from "@/lib/cafe24/config";
import { fetchCafe24OrderLookup, type Cafe24OrderLookupSummary } from "@/lib/cafe24/order-lookup";
import { getCafe24Installation } from "@/lib/cafe24/token-store";
import {
  listRecentCafe24WebhookEvents,
  summarizeCafe24WebhookPayload,
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
  orderLinkLogs: FileOrderLinkLogRecord[];
  proofConfirmations: ProofConfirmationRecord[];
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

type AdminPageProps = {
  searchParams?: {
    auth?: string | string[];
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

function getInternalStorageDisplay(file: UploadedFileRecord) {
  return file.storage_bucket && file.storage_path ? "숨김 처리" : null;
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

const ADMIN_QUICK_NAV_ITEMS = [
  { href: "#cafe24-order-test", label: "주문 조회" },
  { href: "#webhook-logs", label: "Webhook 로그" },
  { href: "#proof-confirmation-logs", label: "교정확인 이력" },
  { href: "#find-files-by-order", label: "주문번호 검색" },
  { href: "#find-file-by-id", label: "파일 ID 검색" },
  { href: "#recent-files", label: "최근 업로드" },
  { href: "#download-logs", label: "다운로드 로그" }
] as const;

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

function AdminQuickNav() {
  return (
    <section className="panel panel-pad" aria-labelledby="admin-quick-nav-title">
      <h2 id="admin-quick-nav-title">빠른 이동</h2>
      <p className="lead">
        자주 확인하는 관리자 섹션으로 바로 이동할 수 있습니다. 기존 조회, 다운로드, 상태 변경 기능은 그대로 유지됩니다.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {ADMIN_QUICK_NAV_ITEMS.map((item) => (
          <a className="button secondary button-small" href={item.href} key={item.href}>
            {item.label}
          </a>
        ))}
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
      downloadLogs: [],
      statusLogs: [],
      orderLinkLogs: [],
      proofConfirmations: [],
      message: null,
      status: "idle"
    };
  }

  if (!query) {
    return {
      query: rawFileId,
      file: null,
      downloadLogs: [],
      statusLogs: [],
      orderLinkLogs: [],
      proofConfirmations: [],
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
        orderLinkLogs: [],
        proofConfirmations: [],
        message: "해당 file_id의 업로드 파일을 찾지 못했습니다.",
        status: "not_found"
      };
    }

    const [downloadLogs, statusLogs, orderLinkLogs, proofConfirmations] = await Promise.all([
      listFileDownloadLogs(file.id, 5),
      listFileStatusChangeLogs(file.id, 10),
      listFileOrderLinkLogs(file.id, 5),
      listProofConfirmationsByFileId(file.id, 10)
    ]);
    return {
      query,
      file,
      downloadLogs,
      statusLogs,
      orderLinkLogs,
      proofConfirmations,
      message: null,
      status: "found"
    };
  } catch (error) {
    return {
      query,
      file: null,
      downloadLogs: [],
      statusLogs: [],
      orderLinkLogs: [],
      proofConfirmations: [],
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

  try {
    cafe24WebhookEvents = await listRecentCafe24WebhookEvents(10, webhookStatusFilter);
  } catch (error) {
    dataError = dataError ?? (error instanceof Error ? error.message : "Failed to load Cafe24 webhook events.");
  }

  try {
    proofConfirmationLogs = await listProofConfirmations({
      proofStatus: proofStatusFilter,
      fileId: proofFileIdFilter,
      orderId: proofOrderIdFilter,
      startDate: proofStartDateFilter,
      endDate: proofEndDateFilter,
      limit: 10
    });
  } catch (error) {
    dataError = dataError ?? (error instanceof Error ? error.message : "Failed to load proof confirmation logs.");
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

function Cafe24OrderApiLookupPanel({
  lookup,
  linkMessage
}: {
  lookup: Cafe24OrderApiLookupState;
  linkMessage: string;
}) {
  return (
    <section className="panel panel-pad" id="cafe24-order-test">
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
        <FileLookupField label="내부 저장 정보" value={getInternalStorageDisplay(file)} emptyText="저장 정보 없음" />
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
  const webhookStatusFilter = getWebhookStatusFilter(readParam(searchParams, "webhook_status"));
  const proofStatusFilter = getProofStatusFilter(readParam(searchParams, "proof_status"));
  const proofFileIdFilter = readParam(searchParams, "proof_file_id").trim();
  const proofOrderIdFilter = readParam(searchParams, "proof_order_id").trim();
  const proofStartDateFilter = readParam(searchParams, "proof_start_date").trim();
  const proofEndDateFilter = readParam(searchParams, "proof_end_date").trim();
  const preservedQuery: AdminPreservedQuery = {
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

      <AdminQuickNav />

      <Cafe24OrderApiLookupPanel lookup={data.cafe24OrderLookup} linkMessage={cafe24AutoLinkMessage} />

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

      <section className="panel panel-pad" id="find-files-by-order">
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
              <FileLookupField
                label="내부 저장 정보"
                value={getInternalStorageDisplay(data.fileLookup.file)}
                emptyText="저장 정보 없음"
              />
              <FileLookupField label="status" value={data.fileLookup.file.status} />
              <FileLookupField label="order_id" value={data.fileLookup.file.order_id} emptyText="미연결" />
              <FileLookupField label="inquiry_id" value={data.fileLookup.file.inquiry_id} emptyText="미연결" />
              <FileLookupField label="created_at" value={data.fileLookup.file.created_at} />
              <FileLookupField label="updated_at" value={data.fileLookup.file.updated_at} />
            </div>
            <OrderLinkPanel file={data.fileLookup.file} message={orderLinkMessage} />
            <OrderLinkLogPanel logs={data.fileLookup.orderLinkLogs} />
            <AdminFileStatusForm fileId={data.fileLookup.file.id} currentStatus={data.fileLookup.file.status} />
            <ReuploadRequestMessagePanel
              currentStatus={data.fileLookup.file.status}
              fileId={data.fileLookup.file.id}
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

      <section className="panel panel-pad" id="recent-files">
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
                    <AdminDownloadLink
                      className="button secondary button-small"
                      href={`/api/files/download?file_id=${encodeURIComponent(file.id)}`}
                    >
                      다운로드
                    </AdminDownloadLink>
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

      <section className="panel panel-pad" id="download-logs">
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
            <AdminRefreshButton />
            <a className="button secondary" href="/admin">초기화</a>
            <a className="button secondary" href={downloadLogsExportHref}>CSV 다운로드</a>
          </div>
        </form>
        <AdminDownloadLogTable logs={data.adminDownloadLogs} />
      </section>
    </main>
  );
}
