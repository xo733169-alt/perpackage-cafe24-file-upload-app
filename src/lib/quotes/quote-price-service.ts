import { getSupabaseAdmin } from "@/lib/supabase/admin";

const PRODUCT_CODE_PATTERN = /^[A-Z0-9_]{3,64}$/;
const OPTION_CODE_PATTERN = /^[a-z0-9_]{1,64}$/;

export type QuotePriceLookupInput = {
  productCode: string;
  sizeCode: string;
  materialCode: string;
  quantity: number;
  printOptionCode: string;
  finishOptionCode: string;
};

export type QuotePriceLookupResult = {
  productCode: string;
  productName: string;
  selection: {
    sizeCode: string;
    materialCode: string;
    quantity: number;
    printOptionCode: string;
    finishOptionCode: string;
  };
  price: {
    currency: "KRW";
    vatInclusivePrice: number;
    unitPrice: number;
  };
};

export type QuoteProductOptionsResult = {
  productCode: string;
  productName: string;
  sizes: Array<{
    code: string;
    label: string;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    allowedMaterialCodes: string[];
  }>;
  materials: Array<{
    code: string;
    label: string;
    basisWeightGsm: number;
  }>;
  quantities: number[];
  printOptions: Array<{ code: string; label: string }>;
  finishOptions: Array<{ code: string; label: string }>;
};

type QuoteProductRecord = {
  id: string;
  product_code: string;
  display_name: string;
};

type IdRecord = { id: string };

type QuotePriceRecord = {
  vat_inclusive_price: number;
  unit_price: number | string;
};

type QuoteSizeRecord = {
  id: string;
  size_code: string;
  display_name: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  sort_order: number;
};

type QuoteMaterialRecord = {
  id: string;
  material_code: string;
  display_name: string;
  basis_weight_gsm: number;
};

type QuoteQuantityRecord = { quantity: number; sort_order: number };
type QuoteOptionRecord = { option_code: string; display_name: string; sort_order: number };
type QuoteSizeMaterialRecord = { size_id: string; material_id: string; sort_order: number };

function normalizeCode(value: string, pattern: RegExp) {
  const normalized = value.trim();
  return pattern.test(normalized) ? normalized : null;
}

function normalizeQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export function normalizeQuotePriceLookupInput(input: Partial<QuotePriceLookupInput>) {
  const productCode = typeof input.productCode === "string"
    ? normalizeCode(input.productCode, PRODUCT_CODE_PATTERN)
    : null;
  const sizeCode = typeof input.sizeCode === "string"
    ? normalizeCode(input.sizeCode, PRODUCT_CODE_PATTERN)
    : null;
  const materialCode = typeof input.materialCode === "string"
    ? normalizeCode(input.materialCode, PRODUCT_CODE_PATTERN)
    : null;
  const printOptionCode = typeof input.printOptionCode === "string"
    ? normalizeCode(input.printOptionCode, OPTION_CODE_PATTERN)
    : null;
  const finishOptionCode = typeof input.finishOptionCode === "string"
    ? normalizeCode(input.finishOptionCode, OPTION_CODE_PATTERN)
    : null;
  const quantity = normalizeQuantity(input.quantity);

  if (
    !productCode ||
    !sizeCode ||
    !materialCode ||
    !quantity ||
    !printOptionCode ||
    !finishOptionCode
  ) {
    return null;
  }

  return {
    productCode,
    sizeCode,
    materialCode,
    quantity,
    printOptionCode,
    finishOptionCode
  } satisfies QuotePriceLookupInput;
}

export function normalizeQuoteProductCode(value: unknown) {
  return typeof value === "string" ? normalizeCode(value, PRODUCT_CODE_PATTERN) : null;
}

async function findActiveProduct(productCode: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quote_products")
    .select("id, product_code, display_name")
    .eq("product_code", productCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load quote product.");
  }

  return data as QuoteProductRecord | null;
}

async function hasActivePriceVersion(productId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quote_price_versions")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load active quote price version.");
  }

  return Boolean(data);
}

export async function getActiveQuoteProductOptions(
  productCode: string
): Promise<QuoteProductOptionsResult | null> {
  const product = await findActiveProduct(productCode);
  if (!product || !(await hasActivePriceVersion(product.id))) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const [sizesResult, materialsResult, quantitiesResult, printOptionsResult, finishOptionsResult, sizeMaterialsResult] =
    await Promise.all([
      supabase
        .from("quote_product_sizes")
        .select("id, size_code, display_name, length_mm, width_mm, height_mm, sort_order")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quote_materials")
        .select("id, material_code, display_name, basis_weight_gsm")
        .eq("is_active", true)
        .order("display_name", { ascending: true }),
      supabase
        .from("quote_product_quantities")
        .select("quantity, sort_order")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quote_product_print_options")
        .select("option_code, display_name, sort_order")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quote_product_finish_options")
        .select("option_code, display_name, sort_order")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quote_product_size_materials")
        .select("size_id, material_id, sort_order")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    ]);

  const results = [
    sizesResult,
    materialsResult,
    quantitiesResult,
    printOptionsResult,
    finishOptionsResult,
    sizeMaterialsResult
  ];
  if (results.some((result) => result.error)) {
    throw new Error("Failed to load quote product options.");
  }

  const sizes = (sizesResult.data ?? []) as unknown as QuoteSizeRecord[];
  const materials = (materialsResult.data ?? []) as unknown as QuoteMaterialRecord[];
  const quantities = (quantitiesResult.data ?? []) as unknown as QuoteQuantityRecord[];
  const printOptions = (printOptionsResult.data ?? []) as unknown as QuoteOptionRecord[];
  const finishOptions = (finishOptionsResult.data ?? []) as unknown as QuoteOptionRecord[];
  const sizeMaterials = (sizeMaterialsResult.data ?? []) as unknown as QuoteSizeMaterialRecord[];

  const materialCodesById = new Map(materials.map((material) => [material.id, material.material_code]));
  const allowedMaterialCodesBySizeId = new Map<string, string[]>();
  for (const relation of sizeMaterials) {
    const materialCode = materialCodesById.get(relation.material_id);
    if (!materialCode) {
      continue;
    }

    const existing = allowedMaterialCodesBySizeId.get(relation.size_id) ?? [];
    existing.push(materialCode);
    allowedMaterialCodesBySizeId.set(relation.size_id, existing);
  }

  return {
    productCode: product.product_code,
    productName: product.display_name,
    sizes: sizes.map((size) => ({
      code: size.size_code,
      label: size.display_name,
      lengthMm: size.length_mm,
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      allowedMaterialCodes: allowedMaterialCodesBySizeId.get(size.id) ?? []
    })),
    materials: materials.map((material) => ({
      code: material.material_code,
      label: material.display_name,
      basisWeightGsm: material.basis_weight_gsm
    })),
    quantities: quantities.map((quantity) => quantity.quantity),
    printOptions: printOptions.map((option) => ({ code: option.option_code, label: option.display_name })),
    finishOptions: finishOptions.map((option) => ({ code: option.option_code, label: option.display_name }))
  };
}

async function findId(input: {
  table:
    | "quote_product_sizes"
    | "quote_materials"
    | "quote_product_quantities"
    | "quote_product_print_options"
    | "quote_product_finish_options";
  column: string;
  value: string | number;
  productId?: string;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(input.table).select("id").eq(input.column, input.value).eq("is_active", true);

  if (input.productId) {
    query = query.eq("product_id", input.productId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve ${input.table}.`);
  }

  return data as IdRecord | null;
}

export async function lookupActiveQuotePrice(
  input: QuotePriceLookupInput
): Promise<QuotePriceLookupResult | null> {
  const product = await findActiveProduct(input.productCode);
  if (!product) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data: versionData, error: versionError } = await supabase
    .from("quote_price_versions")
    .select("id")
    .eq("product_id", product.id)
    .eq("status", "active")
    .maybeSingle();

  if (versionError) {
    throw new Error("Failed to load active quote price version.");
  }

  if (!versionData) {
    return null;
  }

  const [size, material, quantity, printOption, finishOption] = await Promise.all([
    findId({
      table: "quote_product_sizes",
      column: "size_code",
      value: input.sizeCode,
      productId: product.id
    }),
    findId({
      table: "quote_materials",
      column: "material_code",
      value: input.materialCode
    }),
    findId({
      table: "quote_product_quantities",
      column: "quantity",
      value: input.quantity,
      productId: product.id
    }),
    findId({
      table: "quote_product_print_options",
      column: "option_code",
      value: input.printOptionCode,
      productId: product.id
    }),
    findId({
      table: "quote_product_finish_options",
      column: "option_code",
      value: input.finishOptionCode,
      productId: product.id
    })
  ]);

  if (!size || !material || !quantity || !printOption || !finishOption) {
    return null;
  }

  const { data: priceData, error: priceError } = await supabase
    .from("quote_price_matrix")
    .select("vat_inclusive_price, unit_price")
    .eq("product_id", product.id)
    .eq("price_version_id", versionData.id)
    .eq("size_id", size.id)
    .eq("material_id", material.id)
    .eq("quantity_option_id", quantity.id)
    .eq("print_option_id", printOption.id)
    .eq("finish_option_id", finishOption.id)
    .maybeSingle();

  if (priceError) {
    throw new Error("Failed to load quote price.");
  }

  if (!priceData) {
    return null;
  }

  const price = priceData as QuotePriceRecord;
  return {
    productCode: product.product_code,
    productName: product.display_name,
    selection: {
      sizeCode: input.sizeCode,
      materialCode: input.materialCode,
      quantity: input.quantity,
      printOptionCode: input.printOptionCode,
      finishOptionCode: input.finishOptionCode
    },
    price: {
      currency: "KRW",
      vatInclusivePrice: price.vat_inclusive_price,
      unitPrice: Number(price.unit_price)
    }
  };
}
