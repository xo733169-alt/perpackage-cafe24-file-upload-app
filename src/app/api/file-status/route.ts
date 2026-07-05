import { NextRequest, NextResponse } from "next/server";
import { lookupCustomerFileStatus } from "@/lib/files/customer-file-status-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MISSING_INPUT_MESSAGE = "주문번호와 업로드 파일 ID를 모두 입력해 주세요.";
const NOT_FOUND_MESSAGE =
  "입력하신 정보와 일치하는 파일을 찾을 수 없습니다. 주문번호와 업로드 파일 ID를 다시 확인해 주세요.";
const SERVER_ERROR_MESSAGE = "일시적으로 상태 조회가 어렵습니다. 잠시 후 다시 시도해 주세요.";

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {})
    }
  });
}

function readBodyString(body: unknown, key: "order_id" | "file_id") {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderId = readBodyString(body, "order_id");
    const fileId = readBodyString(body, "file_id");

    if (!orderId || !fileId) {
      return noStoreJson(
        {
          success: false,
          error_code: "missing_input",
          error_message: MISSING_INPUT_MESSAGE
        },
        { status: 400 }
      );
    }

    const result = await lookupCustomerFileStatus({ orderId, fileId });
    if (!result) {
      return noStoreJson(
        {
          success: false,
          error_code: "not_found",
          error_message: NOT_FOUND_MESSAGE
        },
        { status: 404 }
      );
    }

    return noStoreJson({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("customer_file_status_lookup_failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });

    return noStoreJson(
      {
        success: false,
        error_code: "server_error",
        error_message: SERVER_ERROR_MESSAGE
      },
      { status: 500 }
    );
  }
}
