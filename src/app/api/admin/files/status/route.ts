import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import { createFileReviewLog } from "@/lib/files/file-review-log-service";
import { isKnownFileStatus } from "@/lib/files/file-status";
import { updateFileStatus } from "@/lib/files/file-service";

export const dynamic = "force-dynamic";

type StatusRequestBody = {
  file_id?: unknown;
  status?: unknown;
  memo?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent")?.slice(0, 500) ?? null;
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(sessionToken)) {
    return jsonError("Unauthorized.", 401);
  }

  let body: StatusRequestBody;
  try {
    body = await request.json() as StatusRequestBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const fileId = typeof body.file_id === "string" ? body.file_id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const memo = typeof body.memo === "string" ? body.memo.trim() : "";

  if (!fileId) {
    return jsonError("file_id is required.", 400);
  }

  if (!status) {
    return jsonError("status is required.", 400);
  }

  if (!isKnownFileStatus(status)) {
    return jsonError("Unsupported file status.", 400);
  }

  try {
    const result = await updateFileStatus({
      fileId,
      status
    });

    const reviewLogResult = await createFileReviewLog({
      fileId,
      previousStatus: result.previousStatus,
      newStatus: status,
      memo,
      adminUser: "admin",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });

    return NextResponse.json({
      ok: true,
      file: {
        id: result.file.id,
        status: result.file.status,
        updated_at: result.file.updated_at
      },
      review_log_saved: reviewLogResult.saved,
      review_log_error_message: reviewLogResult.errorMessage
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update file status.";
    const statusCode = message === "Uploaded file was not found." ? 404 : 500;
    return jsonError(message, statusCode);
  }
}
