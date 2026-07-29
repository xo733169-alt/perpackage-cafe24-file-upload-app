import { NextRequest, NextResponse } from "next/server";
import { getDielineLookup } from "@/lib/dielines/dieline-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const productNo = url.searchParams.get("product_no")?.trim() ?? "";
  const size = url.searchParams.get("size")?.trim() ?? "";

  if (!productNo || !size) {
    return NextResponse.json({ ok: false, message: "product_no and size are required." }, { status: 400 });
  }

  try {
    const dieline = await getDielineLookup(productNo, size);
    return NextResponse.json({
      ok: true,
      available: Boolean(dieline?.aiAvailable || dieline?.pdfAvailable),
      dieline: dieline && {
        product_no: dieline.productNo,
        size_key: dieline.sizeKey,
        ai_available: dieline.aiAvailable,
        pdf_available: dieline.pdfAvailable
      }
    });
  } catch (error) {
    console.error("dieline_lookup_failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ ok: false, message: "Failed to look up dieline." }, { status: 500 });
  }
}
