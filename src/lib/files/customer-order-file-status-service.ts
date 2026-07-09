import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { FileReuploadRequestStatus } from "@/lib/files/reupload-request-service";

type CustomerOrderFileRecord = {
  id: string;
  original_filename: string;
  order_id: string | null;
  status: string | null;
  created_at: string;
};

type CustomerOrderReuploadRequestRecord = {
  id: string;
  original_file_id: string;
  new_file_id: string | null;
  order_id: string | null;
  customer_message: string | null;
  status: FileReuploadRequestStatus;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerOrderFileStatusResult = {
  ok: true;
  has_file: true;
  file: {
    filename: string;
    uploaded_at: string;
    status: string;
    status_label: string;
  };
  reupload: {
    requested: boolean;
    available: false;
    status: FileReuploadRequestStatus | null;
    status_label: string | null;
    message: string | null;
  };
  message: string;
};

const FILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAFE24_ITEM_ORDER_ID_PATTERN = /^(\d{8}-\d{7})-\d{2}$/;

const CUSTOMER_ORDER_FILE_SELECT = [
  "id",
  "original_filename",
  "order_id",
  "status",
  "created_at"
].join(", ");

const CUSTOMER_ORDER_REUPLOAD_SELECT = [
  "id",
  "original_file_id",
  "new_file_id",
  "order_id",
  "customer_message",
  "status",
  "expires_at",
  "used_at",
  "created_at",
  "updated_at"
].join(", ");

const FILE_STATUS_MESSAGES: Record<string, { label: string; message: string }> = {
  uploaded_pending: {
    label: "파일 확인 전",
    message: "업로드한 파일이 접수되었습니다. 담당자가 순차적으로 확인할 예정입니다."
  },
  reviewing: {
    label: "파일 확인 중",
    message: "업로드한 파일을 확인 중입니다."
  },
  approved: {
    label: "파일 확인 완료",
    message: "파일 확인이 완료되었습니다."
  },
  need_reupload: {
    label: "재업로드 요청",
    message: "파일에 수정 또는 재업로드가 필요합니다."
  },
  replaced: {
    label: "새 파일로 교체됨",
    message: "새로 업로드한 파일 기준으로 확인 중입니다."
  },
  archived: {
    label: "보관 처리",
    message: "파일 처리가 완료되었거나 보관 처리되었습니다."
  }
};

const REUPLOAD_STATUS_MESSAGES: Record<FileReuploadRequestStatus, { label: string; message: string }> = {
  requested: {
    label: "재업로드 요청됨",
    message: "파일 재업로드가 필요합니다. 안내받은 재업로드 링크를 이용해 주세요."
  },
  uploaded: {
    label: "재업로드 완료",
    message: "재업로드한 파일이 접수되었습니다."
  },
  reviewing: {
    label: "재업로드 파일 확인 중",
    message: "재업로드한 파일을 확인 중입니다."
  },
  completed: {
    label: "처리 완료",
    message: "재업로드 파일 확인과 처리가 완료되었습니다."
  },
  expired: {
    label: "재업로드 링크 만료",
    message: "재업로드 링크가 만료되었습니다. 새 안내가 필요하면 고객센터로 문의해 주세요."
  },
  canceled: {
    label: "재업로드 요청 취소",
    message: "재업로드 요청이 취소되었습니다."
  },
  failed: {
    label: "재업로드 실패",
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

function normalizeCafe24OrderId(value: string) {
  const itemOrderMatch = value.match(CAFE24_ITEM_ORDER_ID_PATTERN);
  return itemOrderMatch ? itemOrderMatch[1] : value;
}

function sanitizeErrorMessage(message?: string | null) {
  return message?.replace(/\0/g, "").slice(0, 300) ?? null;
}

function sanitizeCustomerMessage(message?: string | null) {
  return message?.replace(/\0/g, "").trim().slice(0, 500) || null;
}

function getFileStatusMessage(status: string | null | undefined) {
  if (!status) {
    return {
      label: "상태 확인 중",
      message: "현재 파일 상태를 확인 중입니다."
    };
  }

  return (
    FILE_STATUS_MESSAGES[status] ?? {
      label: "상태 확인 중",
      message: "현재 파일 상태를 확인 중입니다."
    }
  );
}

function getReuploadStatusMessage(status: FileReuploadRequestStatus) {
  return REUPLOAD_STATUS_MESSAGES[status];
}

function compareRequestByLatest(
  a: CustomerOrderReuploadRequestRecord,
  b: CustomerOrderReuploadRequestRecord
) {
  const aTime = new Date(a.updated_at || a.created_at).getTime();
  const bTime = new Date(b.updated_at || b.created_at).getTime();
  return bTime - aTime;
}

async function getCustomerOrderFile(input: { orderId: string; fileId: string }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("files")
    .select(CUSTOMER_ORDER_FILE_SELECT)
    .eq("id", input.fileId)
    .eq("order_id", input.orderId)
    .maybeSingle();

  if (error) {
    console.error("customer_order_file_status_file_lookup_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message)
    });
    throw new Error("Failed to load customer order file status.");
  }

  return data ? (data as unknown as CustomerOrderFileRecord) : null;
}

async function getLatestCustomerOrderReuploadRequest(input: {
  orderId: string;
  fileId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_reupload_requests")
    .select(CUSTOMER_ORDER_REUPLOAD_SELECT)
    .eq("order_id", input.orderId)
    .or(`original_file_id.eq.${input.fileId},new_file_id.eq.${input.fileId}`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("customer_order_file_status_reupload_lookup_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message)
    });
    return null;
  }

  return ((data ?? []) as unknown as CustomerOrderReuploadRequestRecord[]).sort(compareRequestByLatest)[0] ?? null;
}

export async function lookupCustomerOrderFileStatus(input: {
  orderId: string;
  fileId: string;
}): Promise<CustomerOrderFileStatusResult | null> {
  const inputOrderId = normalizeInput(input.orderId, 120);
  const orderId = inputOrderId ? normalizeCafe24OrderId(inputOrderId) : null;
  const fileId = normalizeInput(input.fileId, 80);

  if (!orderId || !fileId || !FILE_ID_PATTERN.test(fileId)) {
    return null;
  }

  const file = await getCustomerOrderFile({ orderId, fileId });
  if (!file) {
    return null;
  }

  const fileStatus = getFileStatusMessage(file.status);
  const latestReuploadRequest = await getLatestCustomerOrderReuploadRequest({
    orderId,
    fileId
  });
  const reuploadStatus = latestReuploadRequest
    ? getReuploadStatusMessage(latestReuploadRequest.status)
    : null;
  const hasReuploadRequest = Boolean(latestReuploadRequest);
  const requested = file.status === "need_reupload" || latestReuploadRequest?.status === "requested";
  const customerMessage = sanitizeCustomerMessage(latestReuploadRequest?.customer_message);
  const reuploadMessage =
    customerMessage ??
    reuploadStatus?.message ??
    (requested ? "파일 재업로드가 필요합니다. 안내받은 재업로드 링크를 이용해 주세요." : null);

  return {
    ok: true,
    has_file: true,
    file: {
      filename: file.original_filename,
      uploaded_at: file.created_at,
      status: file.status ?? "unknown",
      status_label: fileStatus.label
    },
    reupload: {
      requested,
      available: false,
      status: latestReuploadRequest?.status ?? null,
      status_label: reuploadStatus?.label ?? (requested ? "재업로드 요청" : null),
      message: hasReuploadRequest || requested ? reuploadMessage : null
    },
    message: requested ? reuploadMessage ?? fileStatus.message : fileStatus.message
  };
}
