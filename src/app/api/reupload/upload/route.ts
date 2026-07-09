import { NextRequest, NextResponse } from "next/server";
import {
  completeFileReuploadRequest,
  completeFileReuploadRequestByPublicId
} from "@/lib/files/reupload-request-service";

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

function getSafeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "재업로드에 실패했습니다.";
  }

  return error.message || "재업로드에 실패했습니다.";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const rawToken = formData.get("token");
    const publicId = formData.get("public_id");
    const file = formData.get("file");
    const hasToken = typeof rawToken === "string" && Boolean(rawToken.trim());
    const hasPublicId = typeof publicId === "string" && Boolean(publicId.trim());

    if (!hasToken && !hasPublicId) {
      return NextResponse.json(
        { ok: false, message: "재업로드 링크가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "업로드할 파일을 선택해 주세요." },
        { status: 400 }
      );
    }

    const commonInput = {
      file,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent")
    };
    const result = hasToken
      ? await completeFileReuploadRequest({
          rawToken: rawToken as string,
          ...commonInput
        })
      : await completeFileReuploadRequestByPublicId({
          publicId: publicId as string,
          ...commonInput
        });

    return NextResponse.json({
      ok: true,
      message: "재업로드가 완료되었습니다.",
      file: result.file
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: getSafeErrorMessage(error) },
      { status: 400 }
    );
  }
}
