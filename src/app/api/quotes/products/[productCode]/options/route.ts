import { NextRequest, NextResponse } from "next/server";
import {
  getActiveQuoteProductOptions,
  normalizeQuoteProductCode
} from "@/lib/quotes/quote-price-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CUSTOMER_ORIGINS = new Set([
  "https://peerl.cafe24.com",
  "https://www.peerl.cafe24.com",
  "https://m.peerl.cafe24.com",
  "https://perpackage-cafe24-file-upload-app.vercel.app"
]);

const GENERIC_UNAVAILABLE_MESSAGE = "현재 이 상품의 견적 옵션을 확인할 수 없습니다.";

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS, GET",
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

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || CUSTOMER_ORIGINS.has(origin);
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

export async function OPTIONS(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return new NextResponse(null, { status: 403, headers: getCorsHeaders(request) });
  }

  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function GET(
  request: NextRequest,
  context: { params: { productCode: string } }
) {
  if (!isAllowedOrigin(request)) {
    return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 403 });
  }

  const productCode = normalizeQuoteProductCode(context.params.productCode);
  if (!productCode) {
    return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 400 });
  }

  try {
    const result = await getActiveQuoteProductOptions(productCode);
    if (!result) {
      return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 404 });
    }

    return json(request, {
      ok: true,
      product: {
        code: result.productCode,
        name: result.productName
      },
      sizes: result.sizes.map((size) => ({
        code: size.code,
        label: size.label,
        dimensions_mm: {
          length: size.lengthMm,
          width: size.widthMm,
          height: size.heightMm
        },
        allowed_material_codes: size.allowedMaterialCodes
      })),
      materials: result.materials.map((material) => ({
        code: material.code,
        label: material.label,
        basis_weight_gsm: material.basisWeightGsm
      })),
      quantities: result.quantities,
      print_options: result.printOptions.map((option) => ({ code: option.code, label: option.label })),
      finish_options: result.finishOptions.map((option) => ({ code: option.code, label: option.label }))
    });
  } catch (error) {
    console.error("quote_product_options_lookup_failed", {
      message: error instanceof Error ? error.message : "unknown_error"
    });
    return json(request, { ok: false, message: GENERIC_UNAVAILABLE_MESSAGE }, { status: 500 });
  }
}
