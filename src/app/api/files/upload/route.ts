import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/files/file-service";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
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

    return NextResponse.json({
      ok: true,
      file: {
        id: uploaded.id,
        original_filename: uploaded.original_filename,
        file_size: uploaded.file_size,
        mime_type: uploaded.mime_type,
        status: uploaded.status,
        storage_provider: uploaded.storage_provider,
        storage_path: uploaded.storage_path
      }
    });
  } catch (error) {
    console.error("file_upload_failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "파일 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
