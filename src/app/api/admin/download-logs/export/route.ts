import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import {
  listAdminDownloadLogs,
  type AdminDownloadLogRecord,
  type AdminDownloadLogResultFilter
} from "@/lib/files/download-log-service";

const CSV_EXPORT_LIMIT = 1000;

function getResultFilter(value: string | null): AdminDownloadLogResultFilter {
  return value === "success" || value === "failed" ? value : "all";
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function getValidDateText(value: string | null) {
  const dateText = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : "";
}

function compactDate(value: string) {
  return value.replace(/-/g, "");
}

function getKoreaTodayCompact() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}${month}${day}`;
}

function buildCsvFilename(startDate: string, endDate: string) {
  if (startDate && endDate) {
    return `perpackage-download-logs-${compactDate(startDate)}-${compactDate(endDate)}.csv`;
  }

  if (startDate) {
    return `perpackage-download-logs-from-${compactDate(startDate)}.csv`;
  }

  if (endDate) {
    return `perpackage-download-logs-until-${compactDate(endDate)}.csv`;
  }

  return `perpackage-download-logs-${getKoreaTodayCompact()}.csv`;
}

function buildDownloadLogsCsv(logs: AdminDownloadLogRecord[]) {
  const headers = [
    "다운로드 일시",
    "파일명",
    "파일 ID",
    "Cafe24 주문번호",
    "결과",
    "IP 주소",
    "브라우저",
    "오류 메시지"
  ];

  const rows = logs.map((log) => [
    log.downloaded_at,
    log.original_filename,
    log.file_id,
    log.order_id,
    log.result,
    log.ip_address,
    log.user_agent,
    log.error_message
  ]);

  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ].join("\r\n");
}

export async function GET(request: Request) {
  const sessionToken = cookies().get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(sessionToken)) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDate = getValidDateText(url.searchParams.get("download_start_date"));
  const endDate = getValidDateText(url.searchParams.get("download_end_date"));
  let csv = "";

  try {
    const logs = await listAdminDownloadLogs({
      fileId: url.searchParams.get("download_file_id"),
      orderId: url.searchParams.get("download_order_id"),
      result: getResultFilter(url.searchParams.get("download_result")),
      startDate,
      endDate,
      limit: CSV_EXPORT_LIMIT
    });
    csv = buildDownloadLogsCsv(logs);
  } catch (error) {
    console.error("admin_download_logs_csv_export_failed", {
      message: error instanceof Error ? error.message : "Unknown CSV export error"
    });
    return NextResponse.json({ ok: false, message: "Failed to export download logs." }, { status: 500 });
  }

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildCsvFilename(startDate, endDate)}"`,
      "Cache-Control": "no-store"
    }
  });
}
