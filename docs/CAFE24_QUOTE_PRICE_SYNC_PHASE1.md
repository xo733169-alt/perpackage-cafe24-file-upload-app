# Cafe24 automatic quote price sync: phase 1

## Purpose

The ONE_TOUCH_BOX candidate now synchronizes selections into Cafe24's native
options. It does not yet synchronize the quote price into Cafe24's selected
item, basket, or checkout amount.

The current customer-facing quote total must not be treated as a sale price
until Cafe24's variant price matches it.

## Confirmed current state

- The quote API returns the active Supabase price matrix amount.
- The candidate applies material, size, quantity, print, and finish choices to
  Cafe24 native options in their native order.
- Cafe24 creates the selected product row after all required native options are
  selected.
- Cafe24 currently uses its own product and variant price configuration, so it
  can show a different amount from the quote card.
- The application has `mall.read_product` scope only. It has no product-price
  write route and must not change Cafe24 prices automatically yet.

## Required price model

Use Cafe24's combination variants as the checkout price authority.

```text
Cafe24 base product price + variant additional amount = quote total price
```

For one active quote version:

1. Take the lowest active VAT-inclusive quote total as the proposed Cafe24 base
   product price.
2. Set each Cafe24 combination variant's additional amount to:
   `quote total price - base product price`.
3. Keep the quote matrix version immutable while that Cafe24 variant set is
   active.

This avoids negative variant amounts and makes the product, basket, checkout,
and Cafe24 order amount agree with the quote card.

## Read-only preflight

Run this file manually in Supabase SQL Editor:

`supabase/preflight/20260720_onetouch_cafe24_price_sync_readonly.sql`

It returns:

- one mapped row for every active quote combination;
- the proposed base product price;
- the additional amount required for every Cafe24 combination;
- unmapped material rows, invalid price rows, and duplicate Cafe24 option keys.

Expected safety conditions before continuing:

- `unmapped_material_row_count = 0`
- `invalid_price_row_count = 0`
- duplicate-key query returns no rows
- quote row count equals distinct Cafe24 option key count

The script is read-only. It does not alter Supabase, Cafe24, prices, products,
or options.

## Required Cafe24 verification

Before any write operation, retrieve the current Cafe24 product `76` and its
variants through the authenticated Admin API, then compare these fields with
the preflight export:

- every variant's five option values;
- every variant code;
- current product base price;
- current variant additional amount;
- display and selling state.

The current OAuth scope must be expanded to `mall.write_product` only when the
read-only comparison is clean and a controlled test is approved. Cafe24's
official API documents product-option creation and variant updates separately;
variant updates support `additional_amount` and require the product write
scope. [Cafe24 variant update documentation](https://developers.cafe24.com/docs-new/en/docs/admin/put-products-by-product-no-variants-by-variant-code)

## What must not be done

- Do not make the browser quote card overwrite the displayed Cafe24 amount.
- Do not trust a client-side price value at cart or checkout.
- Do not change Cafe24 product price, option values, or variants before the
  read-only variant comparison passes.
- Do not enable sale status or release the sold-out product for a customer test
  before basket and checkout amounts match the active quote version.

## Implemented read-only comparison

The protected administrator route is now available at:

`GET /api/admin/cafe24/products/76/quote-price-preflight`

It reads the active quote version and Cafe24 product/variant data, then returns
counts only. It verifies the product base price, option-key coverage, duplicate
keys, unreadable variants, and additional-amount mismatches. It does not expose
variant codes, option values, OAuth credentials, or raw Cafe24 API data.

## Next implementation after the comparison is clean

1. Add the comparison result to the protected admin screen for an operator.
2. Request `mall.write_product` and create an explicit, reviewable price-sync
   action. It will require a preflight match, a selected quote price version,
   and an administrator confirmation.
3. Test one controlled combination in the product page, selected item row,
   basket, and checkout before allowing customer orders.

## Scope excluded from phase 1

- Customer-facing hiding of native Cafe24 options.
- New finish/coating pricing.
- Bulk conversion of other package products.
- Customer quote PDF and supplier purchase-order PDF.
