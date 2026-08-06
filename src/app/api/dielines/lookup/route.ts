import { NextRequest, NextResponse } from "next/server";
import { getDielineLookup } from "@/lib/dielines/dieline-service";

export const dynamic = "force-dynamic";

const allowedLookupOrigins = new Set([
  "https://peerl.cafe24.com",
  "https://www.peerl.cafe24.com",
  "https://peerlpackage.com",
  "https://www.peerlpackage.com",
  "https://perpackage-cafe24-file-upload-app.vercel.app"
]);

function getAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin && allowedLookupOrigins.has(origin) ? origin : null;
}

function getCorsHeaders(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS, GET",
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

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && !getAllowedOrigin(request)) {
    return jsonWithCors(request, { ok: false, message: "This lookup origin is not allowed." }, { status: 403 });
  }

  const url = new URL(request.url);
  const productNo = url.searchParams.get("product_no")?.trim() ?? "";
  const size = url.searchParams.get("size")?.trim() ?? "";

  if (!productNo || !size) {
    return jsonWithCors(request, { ok: false, message: "product_no and size are required." }, { status: 400 });
  }

  try {
    const dieline = await getDielineLookup(productNo, size);
    return jsonWithCors(request, {
      ok: true,
      available: Boolean(dieline?.aiAvailable || dieline?.pdfAvailable || dieline?.svgAvailable),
      dieline: dieline && {
        product_no: dieline.productNo,
        size_key: dieline.sizeKey,
        ai_available: dieline.aiAvailable,
        pdf_available: dieline.pdfAvailable,
        svg_available: dieline.svgAvailable
      }
    });
  } catch (error) {
    console.error("dieline_lookup_failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return jsonWithCors(request, { ok: false, message: "Failed to look up dieline." }, { status: 500 });
  }
}
