import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { UploadedFileRecord } from "./types";

export type FileDownloadLogResult = "success" | "failed";

export type FileDownloadLogRecord = {
  id: string;
  file_id: string | null;
  original_filename: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  downloaded_at: string;
  ip_address: string | null;
  user_agent: string | null;
  result: FileDownloadLogResult | string;
  error_message: string | null;
  created_at: string;
};

export type AdminDownloadLogResultFilter = "all" | "success" | "failed";

export type AdminDownloadLogFilters = {
  fileId?: string | null;
  orderId?: string | null;
  result?: AdminDownloadLogResultFilter;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
};

export type AdminDownloadLogRecord = FileDownloadLogRecord & {
  order_id: string | null;
};

export type CreateFileDownloadLogInput = {
  file?: UploadedFileRecord | null;
  fileId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  result: FileDownloadLogResult;
  errorMessage?: string | null;
};

function sanitizeErrorMessage(message?: string | null) {
  if (!message) {
    return null;
  }

  return message.replace(/[\r\n\0]/g, " ").slice(0, 300);
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeResultFilter(value?: AdminDownloadLogResultFilter | null): AdminDownloadLogResultFilter {
  return value === "success" || value === "failed" ? value : "all";
}

function normalizeLimit(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 1000);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getKoreaDateBoundaryIso(value: string | null | undefined, boundary: "start" | "end") {
  const dateText = value?.trim() ?? "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcStart = Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000;
  const parsed = new Date(utcStart + 9 * 60 * 60 * 1000);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const timestamp = boundary === "start" ? utcStart : utcStart + 24 * 60 * 60 * 1000 - 1;
  return new Date(timestamp).toISOString();
}

export async function createFileDownloadLog(input: CreateFileDownloadLogInput) {
  try {
    const file = input.file ?? null;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("file_download_logs")
      .insert({
        file_id: file?.id ?? input.fileId ?? null,
        original_filename: file?.original_filename ?? null,
        storage_bucket: file?.storage_bucket ?? null,
        storage_path: file?.storage_path ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        result: input.result,
        error_message: sanitizeErrorMessage(input.errorMessage)
      });

    if (error) {
      console.error("file_download_log_insert_failed", {
        code: error.code ?? null,
        message: error.message ?? null,
        result: input.result
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("file_download_log_insert_failed", {
      code: null,
      message: error instanceof Error ? error.message : "Unknown download log error",
      result: input.result
    });
    return false;
  }
}

export async function listFileDownloadLogs(fileId: string, limit = 5): Promise<FileDownloadLogRecord[]> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("file_download_logs")
    .select("*")
    .eq("file_id", trimmedFileId)
    .order("downloaded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("file_download_logs_load_failed", {
      code: error.code ?? null,
      message: error.message ?? null
    });
    return [];
  }

  return (data ?? []) as FileDownloadLogRecord[];
}

export async function listAdminDownloadLogs(filters: AdminDownloadLogFilters = {}): Promise<AdminDownloadLogRecord[]> {
  const fileIdFilter = filters.fileId?.trim() ?? "";
  const orderIdFilter = filters.orderId?.trim() ?? "";
  const resultFilter = normalizeResultFilter(filters.result);
  const startDateIso = getKoreaDateBoundaryIso(filters.startDate, "start");
  const endDateIso = getKoreaDateBoundaryIso(filters.endDate, "end");
  const limit = normalizeLimit(filters.limit);
  const shouldFilterFileIdInMemory = Boolean(fileIdFilter && !isUuidLike(fileIdFilter));
  const queryLimit = shouldFilterFileIdInMemory ? Math.max(500, limit) : limit;
  const supabase = getSupabaseAdmin();
  let orderFileIds: string[] | null = null;

  if (orderIdFilter) {
    const { data: orderFiles, error: orderFilesError } = await supabase
      .from("files")
      .select("id")
      .eq("order_id", orderIdFilter);

    if (orderFilesError) {
      console.error("admin_download_logs_order_lookup_failed", {
        code: orderFilesError.code ?? null,
        message: sanitizeErrorMessage(orderFilesError.message)
      });
      throw new Error("Failed to filter download logs by order_id.");
    }

    orderFileIds = uniqueNonEmpty((orderFiles ?? []).map((file) => file.id as string | null));
    if (!orderFileIds.length) {
      return [];
    }
  }

  let query = supabase
    .from("file_download_logs")
    .select("*")
    .order("downloaded_at", { ascending: false })
    .limit(queryLimit);

  if (resultFilter === "success") {
    query = query.eq("result", "success");
  }

  if (resultFilter === "failed") {
    query = query.in("result", ["failed", "error"]);
  }

  if (startDateIso) {
    query = query.gte("downloaded_at", startDateIso);
  }

  if (endDateIso) {
    query = query.lte("downloaded_at", endDateIso);
  }

  if (orderFileIds?.length) {
    query = query.in("file_id", orderFileIds);
  }

  if (fileIdFilter && isUuidLike(fileIdFilter)) {
    query = query.eq("file_id", fileIdFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("admin_download_logs_load_failed", {
      code: error.code ?? null,
      message: sanitizeErrorMessage(error.message),
      resultFilter,
      hasFileIdFilter: Boolean(fileIdFilter),
      hasOrderIdFilter: Boolean(orderIdFilter),
      hasStartDateFilter: Boolean(startDateIso),
      hasEndDateFilter: Boolean(endDateIso)
    });
    throw new Error("Failed to load download logs.");
  }

  let logs = (data ?? []) as FileDownloadLogRecord[];
  if (shouldFilterFileIdInMemory) {
    const normalizedFileIdFilter = fileIdFilter.toLowerCase();
    logs = logs.filter((log) => (log.file_id ?? "").toLowerCase().includes(normalizedFileIdFilter));
  }

  logs = logs.slice(0, limit);

  const fileIds = uniqueNonEmpty(logs.map((log) => log.file_id));
  const orderMap = new Map<string, string | null>();

  if (fileIds.length) {
    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("id, order_id")
      .in("id", fileIds);

    if (filesError) {
      console.error("admin_download_logs_file_join_failed", {
        code: filesError.code ?? null,
        message: sanitizeErrorMessage(filesError.message)
      });
    } else {
      for (const file of files ?? []) {
        orderMap.set(file.id as string, (file.order_id as string | null) ?? null);
      }
    }
  }

  return logs.map((log) => ({
    ...log,
    order_id: log.file_id ? orderMap.get(log.file_id) ?? null : null
  }));
}
