import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/files/file-service";

const allowedUploadOrigins = new Set([
  "https://peerl.cafe24.com",
  "https://www.peerl.cafe24.com",
  "https://perpackage-cafe24-file-upload-app.vercel.app",
  // 페르패키지 전개도 디자인 에디터(카페24 파일업로더 standalone 페이지)에서
  // 완성 디자인 SVG를 업로드해 업로드 파일 ID를 발급받기 위한 origin
  "https://ecimg.cafe24img.com"
]);

function getAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  return allowedUploadOrigins.has(origin) ? origin : null;
}

function getCorsHeaders(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

function jsonWithCors(
  request: NextRequest,
  body: Parameters<typeof NextResponse.json>[0],
  init?: ResponseInit
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(request),
      ...(init?.headers ?? {})
    }
  });
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = getCorsHeaders(request);

  if (origin && !getAllowedOrigin(request)) {
    return new NextResponse(null, { status: 403, headers });
  }

  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && !getAllowedOrigin(request)) {
    return jsonWithCors(
      request,
      { ok: false, message: "This upload origin is not allowed." },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonWithCors(
        request,
        { ok: false, message: "업로드할 파일을 선택해 주세요." },
        { status: 400 }
      );
    }

    const uploaded = await uploadFile({
      file,
      mallId: formData.get("mall_id")?.toString() ?? null,
      shopNo: formData.get("shop_no")?.toString() ?? null,
      productNo: formData.get("product_no")?.toString() ?? null,
      variantCode: formData.get("variant_code")?.toString() ?? null,
      customerType: formData.get("customer_type")?.toString() ?? null,
      customerIdentifier: formData.get("customer_identifier")?.toString() ?? null
    });

    return jsonWithCors(request, {
      ok: true,
      file: {
        id: uploaded.id,
        original_filename: uploaded.original_filename,
        file_size: uploaded.file_size,
        mime_type: uploaded.mime_type,
        status: uploaded.status,
        created_at: uploaded.created_at
      }
    });
  } catch (error) {
    console.error("file_upload_failed", error instanceof Error ? error.message : "unknown_error");
    return jsonWithCors(
      request,
      { ok: false, message: error instanceof Error ? error.message : "파일 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
