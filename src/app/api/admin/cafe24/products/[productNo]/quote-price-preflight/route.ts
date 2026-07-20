import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import {
  fetchCafe24ProductSellingPrice,
  fetchCafe24ProductVariants
} from "@/lib/cafe24/product-variant-lookup";
import { getValidCafe24AccessToken } from "@/lib/cafe24/token-store";
import {
  getExpectedCafe24VariantPrices
} from "@/lib/quotes/cafe24-price-sync-preflight";
import { compareCafe24QuotePrices } from "@/lib/quotes/cafe24-price-sync-comparison";

export const dynamic = "force-dynamic";

const PRODUCT_QUOTE_CODE_MAP: Record<string, string> = {
  "76": "ONE_TOUCH_BOX"
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { productNo: string } }
) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(sessionToken)) {
    return jsonError("Unauthorized.", 401);
  }

  const productNo = params.productNo.trim();
  const quoteProductCode = PRODUCT_QUOTE_CODE_MAP[productNo];
  if (!quoteProductCode) {
    return jsonError("No quote product mapping is configured for this Cafe24 product.", 404);
  }

  try {
    // Resolve once so the two Cafe24 reads cannot trigger competing token refreshes.
    const accessToken = await getValidCafe24AccessToken();
    const [expected, variants, productPrice] = await Promise.all([
      getExpectedCafe24VariantPrices(quoteProductCode),
      fetchCafe24ProductVariants(productNo, undefined, accessToken),
      fetchCafe24ProductSellingPrice(productNo, undefined, accessToken)
    ]);
    if (!expected) {
      return jsonError("No active quote price version is available.", 404);
    }

    const comparison = compareCafe24QuotePrices({
      expectedRows: expected.rows,
      expectedBasePrice: expected.basePrice,
      cafe24BasePrice: productPrice.sellingPrice,
      cafe24Variants: variants
    });

    return NextResponse.json({
      ok: true,
      comparison: {
        cafe24_product_no: productNo,
        quote_product_code: quoteProductCode,
        quote_version_no: expected.versionNo,
        recommended_base_price: expected.basePrice,
        cafe24_base_price: productPrice.sellingPrice,
        base_price_mismatch: comparison.basePriceMismatch,
        quote_variant_count: comparison.quoteVariantCount,
        cafe24_variant_count: comparison.cafe24VariantCount,
        readable_cafe24_variant_count: comparison.readableCafe24VariantCount,
        unreadable_cafe24_variant_count: comparison.unreadableCafe24VariantCount,
        duplicate_quote_option_key_count: comparison.duplicateQuoteOptionKeyCount,
        duplicate_cafe24_variant_key_count: comparison.duplicateCafe24VariantKeyCount,
        missing_expected_variant_count: comparison.missingExpectedVariantCount,
        unexpected_cafe24_variant_count: comparison.unexpectedCafe24VariantCount,
        price_mismatch_count: comparison.priceMismatchCount,
        ready_for_price_write: comparison.readyForPriceWrite
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cafe24 quote price preflight failed.";
    return jsonError(message, 400);
  }
}
