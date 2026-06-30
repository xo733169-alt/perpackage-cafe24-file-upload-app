import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import { createFileDownloadLog } from "@/lib/files/download-log-service";
import { getFileById } from "@/lib/files/file-service";
import type { UploadedFileRecord } from "@/lib/files/types";
import { createSignedDownloadUrl } from "@/lib/storage/naver-object-storage";

export const dynamic = "force-dynamic";

const DOWNLOAD_EXPIRES_IN_SECONDS = 300;
const SUPPORTED_STORAGE_PROVIDER = "naver-object-storage";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function getDownloadFilename(file: UploadedFileRecord) {
  return file.original_filename?.trim() || file.stored_filename?.trim() || file.id;
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

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(sessionToken)) {
    return jsonError("Unauthorized.", 401);
  }

  const url = new URL(request.url);
  const fileId = url.searchParams.get("file_id")?.trim();

  if (!fileId) {
    return jsonError("file_id is required.", 400);
  }

  try {
    const file = await getFileById(fileId);
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    if (!file) {
      return jsonError("Uploaded file was not found.", 404);
    }

    if (file.storage_provider !== SUPPORTED_STORAGE_PROVIDER) {
      await createFileDownloadLog({
        file,
        ipAddress,
        userAgent,
        result: "failed",
        errorMessage: "Unsupported storage provider."
      });
      return jsonError("Unsupported storage provider.", 400);
    }

    if (!file.storage_bucket || !file.storage_path) {
      await createFileDownloadLog({
        file,
        ipAddress,
        userAgent,
        result: "failed",
        errorMessage: "Uploaded file storage metadata is incomplete."
      });
      return jsonError("Uploaded file storage metadata is incomplete.", 409);
    }

    const signedUrl = await createSignedDownloadUrl({
      bucket: file.storage_bucket,
      key: file.storage_path,
      filename: getDownloadFilename(file),
      expiresInSeconds: DOWNLOAD_EXPIRES_IN_SECONDS
    });

    await createFileDownloadLog({
      file,
      ipAddress,
      userAgent,
      result: "success"
    });

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    await createFileDownloadLog({
      fileId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      result: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown download error"
    });
    console.error("file_download_url_failed", {
      fileId,
      message: error instanceof Error ? error.message : "Unknown download error"
    });
    return jsonError("Failed to create download link.", 500);
  }
}
