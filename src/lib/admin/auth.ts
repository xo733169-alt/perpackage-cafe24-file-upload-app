import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE_NAME = "perpackage_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  iat: number;
  exp: number;
  nonce: string;
};

export function getAdminAuthConfigStatus() {
  const hasPassword = Boolean(process.env.ADMIN_ACCESS_PASSWORD?.trim());
  const hasSessionSecret = Boolean(process.env.ADMIN_SESSION_SECRET?.trim());

  return {
    hasPassword,
    hasSessionSecret,
    isConfigured: hasPassword && hasSessionSecret
  };
}

function getAdminAuthConfig() {
  const password = process.env.ADMIN_ACCESS_PASSWORD?.trim();
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim();

  if (!password || !sessionSecret) {
    throw new Error("Missing admin access configuration.");
  }

  return { password, sessionSecret };
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyAdminPassword(password: string) {
  const config = getAdminAuthConfig();
  return safeEqual(hashSecret(password), hashSecret(config.password));
}

export function createAdminSessionToken(now = Date.now()) {
  const config = getAdminAuthConfig();
  const payload: AdminSessionPayload = {
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
    nonce: randomBytes(16).toString("base64url")
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, config.sessionSecret);

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token?: string | null) {
  if (!token) {
    return false;
  }

  const status = getAdminAuthConfigStatus();
  if (!status.isConfigured) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const { sessionSecret } = getAdminAuthConfig();
  const expectedSignature = sign(encodedPayload, sessionSecret);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AdminSessionPayload>;
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function isAdminAuthenticated() {
  return verifyAdminSessionToken(cookies().get(ADMIN_SESSION_COOKIE_NAME)?.value);
}

export function setAdminSessionCookie() {
  cookies().set(ADMIN_SESSION_COOKIE_NAME, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  });
}

export function clearAdminSessionCookie() {
  cookies().set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
