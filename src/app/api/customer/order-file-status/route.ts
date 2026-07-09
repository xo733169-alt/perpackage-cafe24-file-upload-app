import { NextRequest, NextResponse } from "next/server";
import { lookupCustomerOrderFileStatus } from "@/lib/files/customer-order-file-status-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MISSING_INPUT_MESSAGE = "파일 상태를 확인할 수 없습니다.";
const NOT_FOUND_MESSAGE = "파일 상태를 확인할 수 없습니다.";
const SERVER_ERROR_MESSAGE = "일시적으로 파일 상태를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";

const allowedCustomerOrigins = new Set([
  "https://peerl.cafe24.com",
  "https://www.peerl.cafe24.com",
  "https://m.peerl.cafe24.com",
  "https://perpackage-cafe24-file-upload-app.vercel.app",
  "https://ecimg.cafe24img.com"
]);

function getAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  return allowedCustomerOrigins.has(origin) ? origin : null;
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

function noStoreJson(request: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(request),
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
    return noStoreJson(
      request,
      {
        ok: false,
        has_file: false,
        message: "파일 상태를 확인할 수 없습니다."
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const orderId = readBodyString(body, "order_id");
    const fileId = readBodyString(body, "file_id");

    if (!orderId || !fileId) {
      return noStoreJson(
        request,
        {
          ok: false,
          has_file: false,
          message: MISSING_INPUT_MESSAGE
        },
        { status: 400 }
      );
    }

    const result = await lookupCustomerOrderFileStatus({ orderId, fileId });
    if (!result) {
      return noStoreJson(
        request,
        {
          ok: false,
          has_file: false,
          message: NOT_FOUND_MESSAGE
        },
        { status: 404 }
      );
    }

    return noStoreJson(request, result);
  } catch (error) {
    console.error("customer_order_file_status_lookup_failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });

    return noStoreJson(
      request,
      {
        ok: false,
        has_file: false,
        message: SERVER_ERROR_MESSAGE
      },
      { status: 500 }
    );
  }
}
