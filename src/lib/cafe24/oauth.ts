import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getCafe24ApiBaseUrl, requireCafe24Config } from "./config";
import type { Cafe24TokenResponse } from "./types";

export const CAFE24_OAUTH_STATE_COOKIE = "perpackage_cafe24_file_upload_state";

export function createOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}

export function setOAuthStateCookie(state: string) {
  cookies().set(CAFE24_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 10 * 60,
    path: "/"
  });
}

export function readOAuthStateCookie() {
  return cookies().get(CAFE24_OAUTH_STATE_COOKIE)?.value ?? null;
}

export function clearOAuthStateCookie() {
  cookies().delete(CAFE24_OAUTH_STATE_COOKIE);
}

export function buildCafe24AuthorizeUrl(state: string) {
  const config = requireCafe24Config();
  const url = new URL(`${getCafe24ApiBaseUrl(config.mallId)}/api/v2/oauth/authorize`);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(","));
  url.searchParams.set("state", state);

  return url.toString();
}

function normalizeScopes(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean).join(",");
  return value?.trim() || null;
}

export async function requestCafe24Token(params: URLSearchParams): Promise<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string | null;
  scopes: string | null;
}> {
  const config = requireCafe24Config();
  const response = await fetch(`${getCafe24ApiBaseUrl(config.mallId)}/api/v2/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    throw new Error("Cafe24 token request failed.");
  }

  const json = (await response.json()) as Cafe24TokenResponse;

  if (!json.access_token || !json.refresh_token) {
    throw new Error("Cafe24 token response did not include required token fields.");
  }

  const accessExpiresIn = Number(json.expires_in ?? 7200);
  const refreshExpiresIn = Number(json.refresh_token_expires_in ?? 14 * 24 * 60 * 60);

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + (Number.isFinite(accessExpiresIn) ? accessExpiresIn : 7200) * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + (Number.isFinite(refreshExpiresIn) ? refreshExpiresIn : 14 * 24 * 60 * 60) * 1000).toISOString(),
    scopes: normalizeScopes(json.scope ?? json.scopes)
  };
}

export async function exchangeCodeForToken(code: string) {
  const config = requireCafe24Config();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri
  });

  return requestCafe24Token(params);
}

export async function refreshCafe24AccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  return requestCafe24Token(params);
}
