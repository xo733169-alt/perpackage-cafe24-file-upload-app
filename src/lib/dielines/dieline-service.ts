import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type DielineFormat = "ai" | "pdf";

type DielineMappingRow = {
  product_no: string;
  size_key: string;
  ai_storage_bucket: string | null;
  ai_storage_path: string | null;
  ai_filename: string | null;
  pdf_storage_bucket: string | null;
  pdf_storage_path: string | null;
  pdf_filename: string | null;
};

export type DielineFile = {
  bucket: string;
  path: string;
  filename: string | null;
};

export type DielineLookup = {
  productNo: string;
  sizeKey: string;
  aiAvailable: boolean;
  pdfAvailable: boolean;
};

function cleanProductNo(value: string) {
  const productNo = value.trim();
  if (!/^\d+$/.test(productNo)) throw new Error("Invalid product number.");
  return productNo;
}

export function normalizeDielineSize(value: string) {
  const numbers = String(value ?? "").match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length !== 3) return null;

  return numbers.map((number) => number.replace(/\.0+$/, "")).join("x");
}

function hasFile(bucket: string | null, path: string | null) {
  return Boolean(bucket?.trim() && path?.trim());
}

async function getDielineMapping(productNo: string, sizeKey: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("product_dielines")
    .select("product_no,size_key,ai_storage_bucket,ai_storage_path,ai_filename,pdf_storage_bucket,pdf_storage_path,pdf_filename")
    .eq("product_no", cleanProductNo(productNo))
    .eq("size_key", sizeKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error("Failed to load dieline mapping.");
  return data as DielineMappingRow | null;
}

export async function getDielineLookup(productNo: string, rawSize: string): Promise<DielineLookup | null> {
  const sizeKey = normalizeDielineSize(rawSize);
  if (!sizeKey) return null;

  const mapping = await getDielineMapping(productNo, sizeKey);
  if (!mapping) return null;

  return {
    productNo: mapping.product_no,
    sizeKey: mapping.size_key,
    aiAvailable: hasFile(mapping.ai_storage_bucket, mapping.ai_storage_path),
    pdfAvailable: hasFile(mapping.pdf_storage_bucket, mapping.pdf_storage_path)
  };
}

export async function getDielineFile(productNo: string, rawSize: string, format: DielineFormat): Promise<DielineFile | null> {
  const sizeKey = normalizeDielineSize(rawSize);
  if (!sizeKey) return null;

  const mapping = await getDielineMapping(productNo, sizeKey);
  if (!mapping) return null;

  const bucket = format === "ai" ? mapping.ai_storage_bucket : mapping.pdf_storage_bucket;
  const path = format === "ai" ? mapping.ai_storage_path : mapping.pdf_storage_path;
  const filename = format === "ai" ? mapping.ai_filename : mapping.pdf_filename;
  if (!hasFile(bucket, path)) return null;

  return { bucket: bucket!.trim(), path: path!.trim(), filename };
}
