import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import {
  getProofStatusFilter,
  getProofStatusLabel,
  listProofConfirmations,
  type ProofConfirmationRecord
} from "@/lib/files/proof-confirmation-service";

const CSV_EXPORT_LIMIT = 1000;

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
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

function formatSelectedItems(items: string[] | null) {
  if (!items?.length) {
    return "-";
  }

  return items.join(" / ");
}

function summarizeProofResponse(log: ProofConfirmationRecord) {
  return log.reject_reason || log.customer_response || "-";
}

function buildProofConfirmationLogsCsv(logs: ProofConfirmationRecord[]) {
  const headers = [
    "요청일시",
    "상태",
    "Cafe24 주문번호",
    "file_id",
    "선택 항목",
    "추가 메모",
    "회신 채널",
    "고객 회신/수정 요청",
    "처리자"
  ];

  const rows = logs.map((log) => [
    log.requested_at ?? log.created_at,
    getProofStatusLabel(log.proof_status),
    log.order_id,
    log.file_id,
    formatSelectedItems(log.selected_items),
    log.extra_memo,
    log.response_channel,
    summarizeProofResponse(log),
    log.confirmed_by ?? log.requested_by ?? "admin"
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
    const logs = await listProofConfirmations({
      proofStatus: getProofStatusFilter(url.searchParams.get("proof_status")),
      fileId: url.searchParams.get("proof_file_id") ?? "",
      orderId: url.searchParams.get("proof_order_id") ?? "",
      limit: CSV_EXPORT_LIMIT
    });
    csv = buildProofConfirmationLogsCsv(logs);
  } catch (error) {
    console.error("admin_proof_confirmation_logs_csv_export_failed", {
      message: error instanceof Error ? error.message : "Unknown CSV export error"
    });
    return NextResponse.json({ ok: false, message: "Failed to export proof confirmation logs." }, { status: 500 });
  }

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="proof-confirmation-logs-${getKoreaTodayCompact()}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
