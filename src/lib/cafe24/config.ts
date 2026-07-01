export const DEFAULT_CAFE24_API_VERSION = "2024-06-01";
export const DEFAULT_CAFE24_SCOPES = [
  "mall.read_application",
  "mall.read_product",
  "mall.read_category",
  "mall.read_community",
  "mall.read_order"
];

export type Cafe24Config = {
  mallId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  apiVersion: string;
};

export function getCafe24Config(env: NodeJS.ProcessEnv = process.env): Cafe24Config {
  return {
    mallId: env.CAFE24_MALL_ID?.trim() ?? "",
    clientId: env.CAFE24_CLIENT_ID?.trim() ?? "",
    clientSecret: env.CAFE24_CLIENT_SECRET?.trim() ?? "",
    redirectUri: env.CAFE24_REDIRECT_URI?.trim() ?? "",
    scopes: (env.CAFE24_SCOPES?.trim() || DEFAULT_CAFE24_SCOPES.join(","))
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
    apiVersion: env.CAFE24_API_VERSION?.trim() || DEFAULT_CAFE24_API_VERSION
  };
}

export function getCafe24ConfigStatus(env: NodeJS.ProcessEnv = process.env) {
  const config = getCafe24Config(env);
  const missing: string[] = [];

  if (!config.mallId) missing.push("CAFE24_MALL_ID");
  if (!config.clientId) missing.push("CAFE24_CLIENT_ID");
  if (!config.clientSecret) missing.push("CAFE24_CLIENT_SECRET");
  if (!config.redirectUri) missing.push("CAFE24_REDIRECT_URI");

  return {
    ok: missing.length === 0,
    missing,
    hasMallId: Boolean(config.mallId),
    hasClientId: Boolean(config.clientId),
    hasClientSecret: Boolean(config.clientSecret),
    hasRedirectUri: Boolean(config.redirectUri),
    scopes: config.scopes,
    apiVersion: config.apiVersion
  };
}

export function requireCafe24Config(env: NodeJS.ProcessEnv = process.env): Cafe24Config {
  const config = getCafe24Config(env);
  const status = getCafe24ConfigStatus(env);

  if (!status.ok) {
    throw new Error(`Missing Cafe24 configuration: ${status.missing.join(", ")}`);
  }

  return config;
}

export function getCafe24ApiBaseUrl(mallId: string) {
  return `https://${mallId}.cafe24api.com`;
}
