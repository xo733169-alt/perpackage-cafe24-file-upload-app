import test from "node:test";
import assert from "node:assert/strict";

import { compareCafe24QuotePrices } from "../src/lib/quotes/cafe24-price-sync-comparison.ts";

const expectedRows = [
  {
    optionKey: "AB라이트|100*100*60|10|없음|없음",
    quoteTotalPrice: 30290,
    expectedAdditionalAmount: 0
  },
  {
    optionKey: "AB라이트|100*100*60|30|없음|없음",
    quoteTotalPrice: 60580,
    expectedAdditionalAmount: 30290
  }
];

const matchingVariants = [
  {
    variantCode: "P00000CY000A",
    optionValues: ["AB라이트", "100*100*60", "10", "없음", "없음"],
    additionalAmount: 0,
    display: "T",
    selling: "T"
  },
  {
    variantCode: "P00000CY000B",
    optionValues: ["AB라이트", "100*100*60", "30", "없음", "없음"],
    additionalAmount: 30290,
    display: "T",
    selling: "T"
  }
];

test("price sync preflight is ready only when base and every variant match", () => {
  const result = compareCafe24QuotePrices({
    expectedRows,
    expectedBasePrice: 30290,
    cafe24BasePrice: 30290,
    cafe24Variants: matchingVariants
  });

  assert.equal(result.readyForPriceWrite, true);
  assert.equal(result.priceMismatchCount, 0);
  assert.equal(result.missingExpectedVariantCount, 0);
  assert.equal(result.duplicateCafe24VariantKeyCount, 0);
});

test("price sync preflight rejects a base price mismatch", () => {
  const result = compareCafe24QuotePrices({
    expectedRows,
    expectedBasePrice: 30290,
    cafe24BasePrice: 30000,
    cafe24Variants: matchingVariants
  });

  assert.equal(result.basePriceMismatch, true);
  assert.equal(result.readyForPriceWrite, false);
});

test("price sync preflight detects duplicate and incomplete Cafe24 combinations", () => {
  const result = compareCafe24QuotePrices({
    expectedRows,
    expectedBasePrice: 30290,
    cafe24BasePrice: 30290,
    cafe24Variants: [
      matchingVariants[0],
      matchingVariants[0],
      {
        variantCode: "P00000CY000C",
        optionValues: ["AB라이트"],
        additionalAmount: 0,
        display: "T",
        selling: "T"
      }
    ]
  });

  assert.equal(result.duplicateCafe24VariantKeyCount, 1);
  assert.equal(result.unreadableCafe24VariantCount, 1);
  assert.equal(result.missingExpectedVariantCount, 1);
  assert.equal(result.readyForPriceWrite, false);
});
