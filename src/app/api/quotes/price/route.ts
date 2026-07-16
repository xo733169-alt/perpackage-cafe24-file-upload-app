import { NextRequest, NextResponse } from "next/server";
import {
  lookupActiveQuotePrice,
  normalizeQuotePriceLookupInput
} from "@/lib/quotes/quote-price-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CUSTOMER_ORIGINS = new Set([
  "https://peerl.cafe24.com",
  "https://www.peerl.cafe24.com",
  "https://m.peerl.cafe24.com",
  "https://perpackage-cafe24-file-upload-app.vercel.app"
]);

const GENERIC_UNAVAILABLE_MESSAGE = "현재 선택한 사양의 가격을 확인할 수 없습니다.";

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin"
  };

  if (origin && CUSTOMER_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(request: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(request),
      ...(init?.headers ?? {})
    }
  });
}

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || CUSTOMER_ORIGINS.has(origin);
}

export async function OPTIONS(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return new NextResponse(null, { status: 403, headers: getCorsHeaders(request) });
  }

  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null);
    const input = normalizeQuotePriceLookupInput({
      productCode: body?.product_code,
      sizeCode: body?.size_code,
      materialCode: body?.material_code,
      quantity: body?.quantity,
      printOptionCode: body?.print_option_code,
      finishOptionCode: body?.finish_option_code
    });

    if (!input) {
      return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 400 });
    }

    const result = await lookupActiveQuotePrice(input);
    if (!result) {
      return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 404 });
    }

    return json(request, {
      ok: true,
      product: {
        code: result.productCode,
        name: result.productName
      },
      selection: {
        size_code: result.selection.sizeCode,
        material_code: result.selection.materialCode,
        quantity: result.selection.quantity,
        print_option_code: result.selection.printOptionCode,
        finish_option_code: result.selection.finishOptionCode
      },
      price: {
        currency: result.price.currency,
        vat_inclusive_price: result.price.vatInclusivePrice,
        unit_price: result.price.unitPrice
      }
    });
  } catch (error) {
    console.error("quote_price_lookup_failed", {
      message: error instanceof Error ? error.message : "unknown_error"
    });
    return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 500 });
  }
}
