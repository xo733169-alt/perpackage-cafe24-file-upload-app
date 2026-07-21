import type { Cafe24ProductVariantSummary } from "@/lib/cafe24/product-variant-lookup";
import type { ExpectedCafe24VariantPrice } from "@/lib/quotes/cafe24-price-sync-preflight";

export type Cafe24QuotePriceMismatchReason =
  | "cafe24_additional_amount_missing"
  | "cafe24_additional_amount_zero"
  | "cafe24_additional_amount_lower"
  | "cafe24_additional_amount_higher";

export type Cafe24QuotePriceMismatchReasonSummary = {
  reason: Cafe24QuotePriceMismatchReason;
  count: number;
};

export type Cafe24QuotePriceMismatchExample = {
  optionKey: string;
  optionValues: string[];
  expectedAdditionalAmount: number;
  cafe24AdditionalAmount: number | null;
  differenceAmount: number | null;
  reason: Cafe24QuotePriceMismatchReason;
};

export type Cafe24QuotePriceSyncPlanItem = Cafe24QuotePriceMismatchExample & {
  plannedAdditionalAmount: number;
  operation: "set_additional_amount";
};

export type Cafe24QuotePriceComparison = {
  quoteVariantCount: number;
  cafe24VariantCount: number;
  readableCafe24VariantCount: number;
  unreadableCafe24VariantCount: number;
  duplicateQuoteOptionKeyCount: number;
  duplicateCafe24VariantKeyCount: number;
  missingExpectedVariantCount: number;
  unexpectedCafe24VariantCount: number;
  priceMismatchCount: number;
  priceMismatchReasonSummary: Cafe24QuotePriceMismatchReasonSummary[];
  priceSyncPlan: Cafe24QuotePriceSyncPlanItem[];
  priceMismatchExamples: Cafe24QuotePriceMismatchExample[];
  basePriceMismatch: boolean;
  readyForPriceWrite: boolean;
};

const PRICE_MISMATCH_REASON_ORDER: Cafe24QuotePriceMismatchReason[] = [
  "cafe24_additional_amount_missing",
  "cafe24_additional_amount_zero",
  "cafe24_additional_amount_lower",
  "cafe24_additional_amount_higher"
];

function countKeys(keys: string[]) {
  const counts = new Map<string, number>();
  keys.forEach((key) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function buildCafe24VariantOptionKey(optionValues: string[]) {
  return optionValues.map((value) => value.trim()).join("|");
}

function getPriceMismatchReason(
  expectedAdditionalAmount: number,
  cafe24AdditionalAmount: number | null
): Cafe24QuotePriceMismatchReason {
  if (cafe24AdditionalAmount === null) {
    return "cafe24_additional_amount_missing";
  }

  if (cafe24AdditionalAmount === 0) {
    return "cafe24_additional_amount_zero";
  }

  return cafe24AdditionalAmount < expectedAdditionalAmount
    ? "cafe24_additional_amount_lower"
    : "cafe24_additional_amount_higher";
}

export function compareCafe24QuotePrices({
  expectedRows,
  expectedBasePrice,
  cafe24BasePrice,
  cafe24Variants
}: {
  expectedRows: ExpectedCafe24VariantPrice[];
  expectedBasePrice: number;
  cafe24BasePrice: number | null;
  cafe24Variants: Cafe24ProductVariantSummary[];
}): Cafe24QuotePriceComparison {
  const expectedKeyCounts = countKeys(expectedRows.map((row) => row.optionKey));
  const duplicateQuoteOptionKeyCount = Array.from(expectedKeyCounts.values()).filter((count) => count > 1).length;
  const expectedByKey = new Map(expectedRows.map((row) => [row.optionKey, row]));

  const readableVariants = cafe24Variants.filter((variant) => variant.optionValues.length === 5);
  const cafe24KeyCounts = countKeys(readableVariants.map((variant) => buildCafe24VariantOptionKey(variant.optionValues)));
  const duplicateCafe24VariantKeyCount = Array.from(cafe24KeyCounts.values()).filter((count) => count > 1).length;
  const actualByKey = new Map(
    readableVariants.map((variant) => [buildCafe24VariantOptionKey(variant.optionValues), variant])
  );

  const missingExpectedVariantCount = expectedRows.filter((row) => !actualByKey.has(row.optionKey)).length;
  const unexpectedCafe24VariantCount = Array.from(actualByKey.keys()).filter((key) => !expectedByKey.has(key)).length;
  const priceMismatchExamples = expectedRows.flatMap((row) => {
    const variant = actualByKey.get(row.optionKey);
    if (!variant || variant.additionalAmount === row.expectedAdditionalAmount) {
      return [];
    }

    const cafe24AdditionalAmount = variant.additionalAmount;
    return [
      {
        optionKey: row.optionKey,
        optionValues: row.optionKey.split("|"),
        expectedAdditionalAmount: row.expectedAdditionalAmount,
        cafe24AdditionalAmount,
        differenceAmount:
          cafe24AdditionalAmount === null
            ? null
            : cafe24AdditionalAmount - row.expectedAdditionalAmount,
        reason: getPriceMismatchReason(row.expectedAdditionalAmount, cafe24AdditionalAmount)
      }
    ];
  });
  const priceMismatchReasonCounts = new Map<Cafe24QuotePriceMismatchReason, number>();
  priceMismatchExamples.forEach((example) => {
    priceMismatchReasonCounts.set(
      example.reason,
      (priceMismatchReasonCounts.get(example.reason) ?? 0) + 1
    );
  });
  const priceMismatchReasonSummary = PRICE_MISMATCH_REASON_ORDER.flatMap((reason) => {
    const count = priceMismatchReasonCounts.get(reason) ?? 0;
    return count > 0 ? [{ reason, count }] : [];
  });
  const priceMismatchCount = priceMismatchExamples.length;
  const priceSyncPlan = priceMismatchExamples.map((example) => ({
    ...example,
    plannedAdditionalAmount: example.expectedAdditionalAmount,
    operation: "set_additional_amount" as const
  }));
  const basePriceMismatch = cafe24BasePrice !== expectedBasePrice;
  const unreadableCafe24VariantCount = cafe24Variants.length - readableVariants.length;

  return {
    quoteVariantCount: expectedRows.length,
    cafe24VariantCount: cafe24Variants.length,
    readableCafe24VariantCount: actualByKey.size,
    unreadableCafe24VariantCount,
    duplicateQuoteOptionKeyCount,
    duplicateCafe24VariantKeyCount,
    missingExpectedVariantCount,
    unexpectedCafe24VariantCount,
    priceMismatchCount,
    priceMismatchReasonSummary,
    priceSyncPlan,
    priceMismatchExamples: priceMismatchExamples.slice(0, 50),
    basePriceMismatch,
    readyForPriceWrite: (
      unreadableCafe24VariantCount === 0 &&
      duplicateQuoteOptionKeyCount === 0 &&
      duplicateCafe24VariantKeyCount === 0 &&
      missingExpectedVariantCount === 0 &&
      unexpectedCafe24VariantCount === 0 &&
      !basePriceMismatch &&
      priceMismatchCount === 0
    )
  };
}
