import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FileReuploadRequestStatus } from "@/lib/files/reupload-request-service";

type CustomerFileRecord = {
  id: string;
  original_filename: string;
  order_id: string | null;
  status: string | null;
  created_at: string;
};

type CustomerReuploadRequestRecord = {
  id: string;
  original_file_id: string;
  new_file_id: string | null;
  order_id: string | null;
  status: FileReuploadRequestStatus;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerFileStatusLookupResult = {
  file_id: string;
  file_name: string;
  order_id: string;
  status: string;
  status_label: string;
  customer_message: string;
  uploaded_at: string;
  reupload_required: boolean;
  reupload_status: FileReuploadRequestStatus | null;
  reupload_status_label: string | null;
  reupload_message: string | null;
  reupload_available: false;
  reupload_url: null;
};

const FILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CUSTOMER_FILE_SELECT = [
  "id",
  "original_filename",
  "order_id",
  "status",
  "created_at"
].join(", ");

const CUSTOMER_REUPLOAD_SELECT = [
  "id",
  "original_file_id",
  "new_file_id",
  "order_id",
  "status",
  "expires_at",
  "used_at",
  "created_at",
  "updated_at"
].join(", ");

const FILE_STATUS_MESSAGES: Record<string, { label: string; message: string }> = {
  uploaded_pending: {
    label: "파일 접수 완료",
    message: "파일이 정상 접수되었습니다. 담당자가 순차적으로 확인할 예정입니다."
  },
  reviewing: {
    label: "파일 확인 중",
    message: "파일을 확인 중입니다. 인쇄 가능 여부를 검토하고 있습니다."
  },
  approved: {
    label: "파일 확인 완료",
    message: "파일 확인이 완료되었습니다. 제작 진행이 가능한 상태입니다."
  },
  need_reupload: {
    label: "재업로드 필요",
    message: "파일 수정 또는 재업로드가 필요합니다. 안내받은 링크로 수정 파일을 다시 업로드해 주세요."
  },
  replaced: {
    label: "새 파일로 교체됨",
    message: "새 파일로 교체된 이전 파일입니다. 최신 파일 기준으로 확인해 주세요."
  },
  archived: {
    label: "보관 처리",
    message: "처리가 완료되었거나 보관 처리된 파일입니다."
  }
};

const REUPLOAD_STATUS_MESSAGES: Record<FileReuploadRequestStatus, { label: string; message: string }> = {
  requested: {
    label: "재업로드 요청 상태",
    message: "수정 파일 재업로드가 요청된 상태입니다. 안내받은 링크로 파일을 다시 업로드해 주세요."
  },
  uploaded: {
    label: "재업로드 파일 접수 완료",
    message: "재업로드 파일이 접수되었습니다. 담당자가 새 파일을 확인할 예정입니다."
  },
  reviewing: {
    label: "재업로드 파일 확인 중",
    message: "재업로드 파일을 확인 중입니다."
  },
  completed: {
    label: "재업로드 처리 완료",
    message: "재업로드 파일 확인 및 처리가 완료되었습니다."
  },
  expired: {
    label: "재업로드 링크 만료",
    message: "재업로드 링크가 만료되었습니다. 새 링크가 필요하면 고객센터로 문의해 주세요."
  },
  canceled: {
    label: "재업로드 요청 취소",
    message: "재업로드 요청이 취소되었습니다. 필요한 경우 고객센터로 문의해 주세요."
  },
  failed: {
    label: "재업로드 처리 실패",
    message: "재업로드 처리 중 문제가 발생했습니다. 고객센터로 문의해 주세요."
  }
};

function normalizeInput(value: string, maxLength: number) {
  const normalized = value.replace(/\0/g, "").trim();
  if (!normalized || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function sanitizeErrorMessage(message?: string | null) {
  return message?.replace(/\0/g, "").slice(0, 300) ?? null;
}

function getCustomerFileStatus(status: string | null | undefined) {
  if (!status) {
    return {
      label: "상태 확인 필요",
      message: "현재 파일 상태를 확인 중입니다. 필요한 경우 고객센터로 문의해 주세요."
    };
  }

  return (
    FILE_STATUS_MESSAGES[status] ?? {
      label: "상태 확인 필요",
      message: "현재 파일 상태를 확인 중입니다. 필요한 경우 고객센터로 문의해 주세요."
    }
  );
}

function getCustomerReuploadStatus(status: FileReuploadRequestStatus) {
  return REUPLOAD_STATUS_MESSAGES[status];
}

function compareRequestByLatest(a: CustomerReuploadRequestRecord, b: CustomerReuploadRequestRecord) {
  const aTime = new Date(a.updated_at || a.created_at).getTime();
  const bTime = new Date(b.updated_at || b.created_at).getTime();
  return bTime - aTime;
}

async function listCustomerReuploadRequestsByColumn(column: "original_file_id" | "new_file_id", fileId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_reupload_requests")
    .select(CUSTOMER_REUPLOAD_SELECT)
    .eq(column, fileId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("customer_file_status_reupload_lookup_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      column
    });
    return [];
  }

  return (data ?? []) as unknown as CustomerReuploadRequestRecord[];
}

async function getLatestCustomerReuploadRequest(fileId: string) {
  const [originalRequests, newFileRequests] = await Promise.all([
    listCustomerReuploadRequestsByColumn("original_file_id", fileId),
    listCustomerReuploadRequestsByColumn("new_file_id", fileId)
  ]);

  const uniqueRequests = new Map<string, CustomerReuploadRequestRecord>();
  for (const request of [...originalRequests, ...newFileRequests]) {
    uniqueRequests.set(request.id, request);
  }

  return [...uniqueRequests.values()].sort(compareRequestByLatest)[0] ?? null;
}

async function getCustomerFileById(fileId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .select(CUSTOMER_FILE_SELECT)
    .eq("id", fileId)
    .maybeSingle();

  if (error) {
    console.error("customer_file_status_file_lookup_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message)
    });
    throw new Error("Failed to load customer file status.");
  }

  return data ? (data as unknown as CustomerFileRecord) : null;
}

export async function lookupCustomerFileStatus(input: {
  orderId: string;
  fileId: string;
}): Promise<CustomerFileStatusLookupResult | null> {
  const orderId = normalizeInput(input.orderId, 120);
  const fileId = normalizeInput(input.fileId, 80);

  if (!orderId || !fileId || !FILE_ID_PATTERN.test(fileId)) {
    return null;
  }

  const file = await getCustomerFileById(fileId);
  if (!file || file.order_id?.trim() !== orderId) {
    return null;
  }

  const fileStatus = getCustomerFileStatus(file.status);
  const latestReuploadRequest = await getLatestCustomerReuploadRequest(file.id);
  const reuploadStatus = latestReuploadRequest
    ? getCustomerReuploadStatus(latestReuploadRequest.status)
    : null;
  const hasRequestedReupload = latestReuploadRequest?.status === "requested";
  const reuploadRequired = file.status === "need_reupload" || hasRequestedReupload;

  return {
    file_id: file.id,
    file_name: file.original_filename,
    order_id: orderId,
    status: file.status ?? "unknown",
    status_label: fileStatus.label,
    customer_message: fileStatus.message,
    uploaded_at: file.created_at,
    reupload_required: reuploadRequired,
    reupload_status: latestReuploadRequest?.status ?? null,
    reupload_status_label: reuploadStatus?.label ?? null,
    reupload_message:
      reuploadStatus?.message ??
      (reuploadRequired ? "재업로드가 필요한 파일입니다. 안내받은 재업로드 링크를 이용해 주세요." : null),
    reupload_available: false,
    reupload_url: null
  };
}
