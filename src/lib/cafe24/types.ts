export type Cafe24LaunchParams = {
  auth_config?: string;
  is_multi_shop?: string;
  lang?: string;
  mall_id?: string;
  nation?: string;
  shop_no?: string;
  timestamp?: string;
  user_id?: string;
  user_name?: string;
  user_type?: string;
  hmac?: string;
};

export type SafeCafe24LaunchContext = {
  mallId: string | null;
  shopNo: string | null;
  lang: string | null;
  nation: string | null;
  userId: string | null;
  userName: string | null;
  userType: string | null;
  isMultiShop: string | null;
};

export type Cafe24Installation = {
  id?: string;
  mall_id: string;
  shop_no: string | null;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string | null;
  scopes: string | null;
  user_id: string | null;
  user_type: string | null;
  status: string;
};

export type Cafe24TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  refresh_token_expires_in?: number | string;
  expires_at?: string;
  refresh_token_expires_at?: string;
  scope?: string | string[];
  scopes?: string | string[];
  token_type?: string;
};
