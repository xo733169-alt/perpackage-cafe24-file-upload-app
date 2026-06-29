export type UploadedFileRecord = {
  id: string;
  mall_id: string | null;
  shop_no: string | null;
  product_no: string | null;
  variant_code: string | null;
  customer_type: string | null;
  customer_identifier: string | null;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  mime_type: string;
  storage_provider: string;
  storage_bucket: string;
  storage_path: string;
  public_preview_url: string | null;
  secure_download_url: string | null;
  order_id: string | null;
  inquiry_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type FileUploadInput = {
  file: File;
  mallId?: string | null;
  shopNo?: string | null;
  productNo?: string | null;
  variantCode?: string | null;
  customerType?: string | null;
  customerIdentifier?: string | null;
};
