import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import {
  buildReuploadRequestMessage,
  createFileReuploadRequest
} from "@/lib/files/reupload-request-service";

export const dynamic = "force-dynamic";

type CreateReuploadRequestBody = {
  original_file_id?: unknown;
  reason?: unknown;
  customer_message?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, maxLength) : "";
}

function getRequestOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

  if (host) {
    return `${forwardedProto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(sessionToken)) {
    return jsonError("Unauthorized.", 401);
  }

  let body: CreateReuploadRequestBody;
  try {
    body = await request.json() as CreateReuploadRequestBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const originalFileId = safeText(body.original_file_id, 120);
  const reason = safeText(body.reason, 1000);
  const customerMessage = safeText(body.customer_message, 2000);

  if (!originalFileId) {
    return jsonError("file_id is required.", 400);
  }

  if (!reason) {
    return jsonError("reason is required.", 400);
  }

  try {
    const result = await createFileReuploadRequest({
      originalFileId,
      reason,
      customerMessage,
      createdBy: "admin"
    });
    const origin = getRequestOrigin(request);
    const reuploadUrl = `${origin}/reupload?token=${encodeURIComponent(result.rawToken)}`;
    const message = buildReuploadRequestMessage({
      orderId: result.file.order_id,
      originalFilename: result.file.original_filename,
      reason,
      customerMessage,
      reuploadUrl
    });

    return NextResponse.json({
      ok: true,
      request: result.request,
      reupload_url: reuploadUrl,
      message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create file reupload request.";
    const status = message === "Uploaded file was not found." ? 404 : 500;
    return jsonError(message, status);
  }
}
