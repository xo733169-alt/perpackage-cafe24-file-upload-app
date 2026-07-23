import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin/auth";
import {
  fetchCafe24ProductSellingPrice,
  fetchCafe24ProductVariants,
  updateCafe24ProductVariantAdditionalAmount
} from "@/lib/cafe24/product-variant-lookup";
import { getCafe24Installation, getValidCafe24AccessToken } from "@/lib/cafe24/token-store";
import { compareCafe24QuotePrices } from "@/lib/quotes/cafe24-price-sync-comparison";
import { getExpectedCafe24VariantPrices } from "@/lib/quotes/cafe24-price-sync-preflight";

export const dynamic = "force-dynamic";

const PRODUCT_NO = "76";
const QUOTE_PRODUCT_CODE = "ONE_TOUCH_BOX";
const CONFIRMATION = "APPLY_PRODUCT_76_ADDITIONAL_AMOUNTS";
const BATCH_SIZE = 20;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function splitIntoBatches<T>(items: T[], batchSize: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { productNo: string } }
) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(sessionToken)) {
    return jsonError("Unauthorized.", 401);
  }
  if (params.productNo.trim() !== PRODUCT_NO) {
    return jsonError("No quote price sync is configured for this Cafe24 product.", 404);
  }

  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== CONFIRMATION) {
    return jsonError("Explicit price sync confirmation is required.", 400);
  }

  try {
    const [accessToken, installation] = await Promise.all([
      getValidCafe24AccessToken(),
      getCafe24Installation()
    ]);
    const [expected, variants, productPrice] = await Promise.all([
      getExpectedCafe24VariantPrices(QUOTE_PRODUCT_CODE),
      fetchCafe24ProductVariants(PRODUCT_NO, undefined, accessToken),
      fetchCafe24ProductSellingPrice(PRODUCT_NO, undefined, accessToken)
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
    if (!comparison.readyForPriceWrite) {
      return jsonError("Cafe24 price sync preflight is not safe to apply.", 409);
    }

    const updates = comparison.priceSyncPlan.map((item) => ({
      variantCode: item.cafe24VariantCode,
      additionalAmount: item.plannedAdditionalAmount
    }));
    if (updates.some((item) => !item.variantCode)) {
      return jsonError("Cafe24 variant code is missing from the price sync plan.", 409);
    }

    const completedVariantCodes: string[] = [];
    for (const batch of splitIntoBatches(updates, BATCH_SIZE)) {
      await Promise.all(batch.map(async (item) => {
        await updateCafe24ProductVariantAdditionalAmount(PRODUCT_NO, {
          variantCode: item.variantCode!,
          additionalAmount: item.additionalAmount
        }, undefined, accessToken, installation?.shop_no ?? null);
      }));
      completedVariantCodes.push(...batch.map((item) => item.variantCode!));

      const verifiedVariants = await fetchCafe24ProductVariants(PRODUCT_NO, undefined, accessToken);
      const verifiedByCode = new Map(verifiedVariants.map((item) => [item.variantCode, item.additionalAmount]));
      const unverifiedCount = completedVariantCodes.filter((variantCode) => {
        const planned = updates.find((item) => item.variantCode === variantCode);
        return !planned || verifiedByCode.get(variantCode) !== planned.additionalAmount;
      }).length;
      if (unverifiedCount > 0) {
        return jsonError("Cafe24 price sync verification failed; stop and use the rollback CSV.", 502);
      }
    }

    return NextResponse.json({
      ok: true,
      cafe24_product_no: PRODUCT_NO,
      updated_variant_count: completedVariantCodes.length,
      batch_count: Math.ceil(completedVariantCodes.length / BATCH_SIZE)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cafe24 quote price sync failed.";
    return jsonError(message, 502);
  }
}
