import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import {
  listAdminDownloadLogs,
  type AdminDownloadLogRecord,
  type AdminDownloadLogResultFilter
} from "@/lib/files/download-log-service";

const CSV_FILENAME = "perpackage-file-download-logs.csv";
const CSV_EXPORT_LIMIT = 1000;

function getResultFilter(value: string | null): AdminDownloadLogResultFilter {
  return value === "success" || value === "failed" ? value : "all";
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildDownloadLogsCsv(logs: AdminDownloadLogRecord[]) {
  const headers = [
    "downloaded_at",
    "original_filename",
    "file_id",
    "order_id",
    "result",
    "ip_address",
    "user_agent",
    "error_message"
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
  let csv = "";

  try {
    const logs = await listAdminDownloadLogs({
      fileId: url.searchParams.get("download_file_id"),
      orderId: url.searchParams.get("download_order_id"),
      result: getResultFilter(url.searchParams.get("download_result")),
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
      "Content-Disposition": `attachment; filename="${CSV_FILENAME}"`,
      "Cache-Control": "no-store"
    }
  });
}
