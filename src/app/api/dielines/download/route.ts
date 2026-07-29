import { NextRequest, NextResponse } from "next/server";
import { type DielineFormat, getDielineFile } from "@/lib/dielines/dieline-service";
import { createSignedDownloadUrl } from "@/lib/storage/naver-object-storage";

export const dynamic = "force-dynamic";

const EXPIRES_IN_SECONDS = 300;

function isFormat(value: string | null): value is DielineFormat {
  return value === "ai" || value === "pdf";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const productNo = url.searchParams.get("product_no")?.trim() ?? "";
  const size = url.searchParams.get("size")?.trim() ?? "";
  const format = url.searchParams.get("format");

  if (!productNo || !size || !isFormat(format)) {
    return NextResponse.json({ ok: false, message: "Invalid dieline download request." }, { status: 400 });
  }

  try {
    const file = await getDielineFile(productNo, size, format);
    if (!file) return NextResponse.json({ ok: false, message: "Dieline file was not found." }, { status: 404 });

    const signedUrl = await createSignedDownloadUrl({
      bucket: file.bucket,
      key: file.path,
      filename: file.filename,
      expiresInSeconds: EXPIRES_IN_SECONDS
    });
    const response = NextResponse.redirect(signedUrl, 302);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  } catch (error) {
    console.error("dieline_download_url_failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ ok: false, message: "Failed to prepare dieline download." }, { status: 500 });
  }
}
