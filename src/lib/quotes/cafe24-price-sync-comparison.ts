import type { Cafe24ProductVariantSummary } from "@/lib/cafe24/product-variant-lookup";
import type { ExpectedCafe24VariantPrice } from "@/lib/quotes/cafe24-price-sync-preflight";

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
  basePriceMismatch: boolean;
  readyForPriceWrite: boolean;
};

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
  const priceMismatchCount = expectedRows.filter((row) => {
    const variant = actualByKey.get(row.optionKey);
    return variant && variant.additionalAmount !== row.expectedAdditionalAmount;
  }).length;
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
