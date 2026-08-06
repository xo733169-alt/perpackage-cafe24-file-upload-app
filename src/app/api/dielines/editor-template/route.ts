import { NextRequest, NextResponse } from "next/server";
import { getDielineSvgFile } from "@/lib/dielines/dieline-service";
import { readTextFromNaverObjectStorage } from "@/lib/storage/naver-object-storage";

export const dynamic = "force-dynamic";

const allowedOrigins = new Set([
  "https://ecimg.cafe24img.com",
  "https://peerl.cafe24.com",
  "https://www.peerl.cafe24.com",
  "https://peerlpackage.com",
  "https://www.peerlpackage.com",
  "https://perpackage-cafe24-file-upload-app.vercel.app"
]);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };

  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function isAllowedRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins.has(origin);
}

export async function OPTIONS(request: NextRequest) {
  if (!isAllowedRequest(request)) return new NextResponse(null, { status: 403, headers: corsHeaders(request) });
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json({ ok: false, message: "This editor origin is not allowed." }, { status: 403, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
  const productNo = url.searchParams.get("product_no")?.trim() ?? "";
  const size = url.searchParams.get("size")?.trim() ?? "";
  if (!productNo || !size) {
    return NextResponse.json({ ok: false, message: "product_no and size are required." }, { status: 400, headers: corsHeaders(request) });
  }

  try {
    const file = await getDielineSvgFile(productNo, size);
    if (!file) return NextResponse.json({ ok: false, message: "Editor SVG was not found." }, { status: 404, headers: corsHeaders(request) });

    const svg = await readTextFromNaverObjectStorage({ bucket: file.bucket, key: file.path });
    return new NextResponse(svg, {
      headers: {
        ...corsHeaders(request),
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("dieline_editor_svg_failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ ok: false, message: "Failed to load editor SVG." }, { status: 500, headers: corsHeaders(request) });
  }
}
