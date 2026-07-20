import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MATERIAL_VALUE_MAP: Record<string, string> = {
  AB_LIGHT_250: "AB라이트",
  AB_LIGHT_270: "AB라이트",
  BAMBOO_NATURAL_300: "밤부팩(내추럴)",
  BAMBOO_NATURAL_350: "밤부팩(내추럴)",
  EGGSHELL_300: "에그쉘팩",
  EGGSHELL_350: "에그쉘팩",
  OLD_MILL_RECYCLE_300: "올드밀(리사이클)",
  OLD_MILL_RECYCLE_350: "올드밀(리사이클)",
  KRAFT_300: "크라프트지",
  KRAFT_350: "크라프트지"
};

type QuoteMatrixRow = {
  vat_inclusive_price: number;
  size_id: string;
  material_id: string;
  quantity_option_id: string;
  print_option_id: string;
  finish_option_id: string;
};

type SizeRow = { id: string; display_name: string };
type MaterialRow = { id: string; material_code: string };
type QuantityRow = { id: string; quantity: number };
type NamedOptionRow = { id: string; display_name: string };

export type ExpectedCafe24VariantPrice = {
  optionKey: string;
  quoteTotalPrice: number;
  expectedAdditionalAmount: number;
};

function makeOptionKey(values: Array<string | number | null>) {
  return values.map((value) => String(value ?? "").trim()).join("|");
}

export async function getExpectedCafe24VariantPrices(productCode: string) {
  const supabase = getSupabaseAdmin();
  const { data: product, error: productError } = await supabase
    .from("quote_products")
    .select("id")
    .eq("product_code", productCode)
    .eq("is_active", true)
    .maybeSingle();

  if (productError) throw new Error("Failed to load quote product.");
  if (!product) return null;

  const { data: version, error: versionError } = await supabase
    .from("quote_price_versions")
    .select("id,version_no")
    .eq("product_id", product.id)
    .eq("status", "active")
    .maybeSingle();

  if (versionError) throw new Error("Failed to load active quote price version.");
  if (!version) return null;

  const [matrixResult, sizeResult, materialResult, quantityResult, printResult, finishResult] = await Promise.all([
    supabase
      .from("quote_price_matrix")
      .select("vat_inclusive_price,size_id,material_id,quantity_option_id,print_option_id,finish_option_id")
      .eq("product_id", product.id)
      .eq("price_version_id", version.id),
    supabase
      .from("quote_product_sizes")
      .select("id,display_name")
      .eq("product_id", product.id)
      .eq("is_active", true),
    supabase
      .from("quote_materials")
      .select("id,material_code")
      .eq("is_active", true),
    supabase
      .from("quote_product_quantities")
      .select("id,quantity")
      .eq("product_id", product.id)
      .eq("is_active", true),
    supabase
      .from("quote_product_print_options")
      .select("id,display_name")
      .eq("product_id", product.id)
      .eq("is_active", true),
    supabase
      .from("quote_product_finish_options")
      .select("id,display_name")
      .eq("product_id", product.id)
      .eq("is_active", true)
  ]);

  if ([matrixResult, sizeResult, materialResult, quantityResult, printResult, finishResult].some((result) => result.error)) {
    throw new Error("Failed to load active quote prices.");
  }

  const rows = (matrixResult.data ?? []) as unknown as QuoteMatrixRow[];
  const sizesById = new Map(((sizeResult.data ?? []) as unknown as SizeRow[]).map((row) => [row.id, row]));
  const materialsById = new Map(((materialResult.data ?? []) as unknown as MaterialRow[]).map((row) => [row.id, row]));
  const quantitiesById = new Map(((quantityResult.data ?? []) as unknown as QuantityRow[]).map((row) => [row.id, row]));
  const printsById = new Map(((printResult.data ?? []) as unknown as NamedOptionRow[]).map((row) => [row.id, row]));
  const finishesById = new Map(((finishResult.data ?? []) as unknown as NamedOptionRow[]).map((row) => [row.id, row]));

  const basePrice = Math.min(...rows.map((row) => Number(row.vat_inclusive_price)));
  if (!Number.isFinite(basePrice)) return null;

  const expected = rows.flatMap((row) => {
    const size = sizesById.get(row.size_id);
    const material = materialsById.get(row.material_id);
    const quantity = quantitiesById.get(row.quantity_option_id);
    const print = printsById.get(row.print_option_id);
    const finish = finishesById.get(row.finish_option_id);
    const materialValue = material ? MATERIAL_VALUE_MAP[material.material_code] : null;
    const quoteTotalPrice = Number(row.vat_inclusive_price);

    if (!size || !materialValue || !quantity || !print || !finish || !Number.isFinite(quoteTotalPrice)) {
      return [];
    }

    return [{
      optionKey: makeOptionKey([materialValue, size.display_name, quantity.quantity, print.display_name, finish.display_name]),
      quoteTotalPrice,
      expectedAdditionalAmount: quoteTotalPrice - basePrice
    } satisfies ExpectedCafe24VariantPrice];
  });

  return {
    versionNo: Number(version.version_no),
    basePrice,
    rows: expected
  };
}

export function buildCafe24VariantOptionKey(optionValues: string[]) {
  return makeOptionKey(optionValues);
}
