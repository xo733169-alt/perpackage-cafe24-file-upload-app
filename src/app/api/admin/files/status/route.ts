import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import { isKnownFileStatus } from "@/lib/files/file-status";
import {
  FileStatusConcurrentChangeError,
  FileStatusTransitionError,
  updateFileStatus
} from "@/lib/files/file-service";

export const dynamic = "force-dynamic";

type StatusRequestBody = {
  file_id?: unknown;
  expected_status?: unknown;
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
  const expectedStatus = typeof body.expected_status === "string" ? body.expected_status.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const memo = typeof body.memo === "string" ? body.memo.trim() : "";

  if (!fileId) {
    return jsonError("file_id is required.", 400);
  }

  if (!status) {
    return jsonError("status is required.", 400);
  }

  if (!expectedStatus) {
    return jsonError("현재 상태를 확인할 수 없습니다. 화면을 새로고침해 주세요.", 400);
  }

  if (!isKnownFileStatus(expectedStatus) || !isKnownFileStatus(status)) {
    return jsonError("Unsupported file status.", 400);
  }

  try {
    const result = await updateFileStatus({
      fileId,
      expectedStatus,
      status,
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
      review_log_saved: true,
      review_log_error_message: null,
      changed: result.changed
    });
  } catch (error) {
    if (error instanceof FileStatusTransitionError) {
      return jsonError("현재 상태에서는 선택한 상태로 변경할 수 없습니다. 화면을 새로고침해 주세요.", 409);
    }

    if (error instanceof FileStatusConcurrentChangeError) {
      return jsonError("다른 작업에서 파일 상태가 먼저 변경되었습니다. 화면을 새로고침해 주세요.", 409);
    }

    const message = error instanceof Error ? error.message : "Failed to update file status.";
    const statusCode = message === "Uploaded file was not found." ? 404 : 500;
    return jsonError(message, statusCode);
  }
}
