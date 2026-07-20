import { getCafe24Config } from "./config";
import { refreshCafe24AccessToken } from "./oauth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const refreshInFlightByMall = new Map<string, Promise<string>>();

type InstallationRow = {
  id: string;
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

export async function upsertCafe24Installation(input: {
  mallId?: string | null;
  shopNo?: string | null;
  userId?: string | null;
  userType?: string | null;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string | null;
  scopes: string | null;
}) {
  const config = getCafe24Config();
  const mallId = input.mallId?.trim() || config.mallId;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cafe24_installations")
    .upsert({
      mall_id: mallId,
      shop_no: input.shopNo ?? null,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      access_token_expires_at: input.accessTokenExpiresAt,
      refresh_token_expires_at: input.refreshTokenExpiresAt,
      scopes: input.scopes,
      user_id: input.userId ?? null,
      user_type: input.userType ?? null,
      status: "connected",
      updated_at: new Date().toISOString()
    }, {
      onConflict: "mall_id"
    })
    .select()
    .single();

  if (error) throw new Error("Failed to store Cafe24 installation.");
  return data as InstallationRow;
}

export async function getCafe24Installation(mallId?: string | null) {
  const config = getCafe24Config();
  const resolvedMallId = mallId?.trim() || config.mallId;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cafe24_installations")
    .select("id,mall_id,shop_no,access_token,refresh_token,access_token_expires_at,refresh_token_expires_at,scopes,user_id,user_type,status")
    .eq("mall_id", resolvedMallId)
    .maybeSingle();

  if (error) throw new Error("Failed to read Cafe24 installation.");
  return data as InstallationRow | null;
}

function shouldRefresh(expiresAt: string) {
  const time = new Date(expiresAt).getTime();
  return !Number.isFinite(time) || time <= Date.now() + REFRESH_MARGIN_MS;
}

async function refreshInstallationAccessToken(installation: InstallationRow) {
  const refreshed = await refreshCafe24AccessToken(installation.refresh_token);
  const updated = await upsertCafe24Installation({
    mallId: installation.mall_id,
    shopNo: installation.shop_no,
    userId: installation.user_id,
    userType: installation.user_type,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt,
    scopes: refreshed.scopes ?? installation.scopes
  });

  return updated.access_token;
}

export async function getValidCafe24AccessToken(mallId?: string | null) {
  const installation = await getCafe24Installation(mallId);

  if (!installation) {
    throw new Error("Cafe24 installation is not connected.");
  }

  if (!shouldRefresh(installation.access_token_expires_at)) {
    return installation.access_token;
  }

  const installationMallId = installation.mall_id;
  const existingRefresh = refreshInFlightByMall.get(installationMallId);
  if (existingRefresh) return existingRefresh;

  const refreshPromise = refreshInstallationAccessToken(installation);
  refreshInFlightByMall.set(installationMallId, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    if (refreshInFlightByMall.get(installationMallId) === refreshPromise) {
      refreshInFlightByMall.delete(installationMallId);
    }
  }
}
