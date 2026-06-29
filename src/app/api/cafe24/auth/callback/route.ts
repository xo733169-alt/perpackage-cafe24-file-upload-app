import { NextRequest, NextResponse } from "next/server";
import { getCafe24Config } from "@/lib/cafe24/config";
import { clearOAuthStateCookie, exchangeCodeForToken, readOAuthStateCookie } from "@/lib/cafe24/oauth";
import { upsertCafe24Installation } from "@/lib/cafe24/token-store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = readOAuthStateCookie();

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json(
      { ok: false, message: "Cafe24 OAuth 응답을 확인할 수 없습니다." },
      { status: 400 }
    );
  }

  try {
    const config = getCafe24Config();
    const token = await exchangeCodeForToken(code);

    await upsertCafe24Installation({
      mallId: config.mallId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      scopes: token.scopes
    });

    clearOAuthStateCookie();

    return NextResponse.redirect(new URL("/admin?oauth=connected", request.url));
  } catch (error) {
    console.error("cafe24_oauth_callback_failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json(
      { ok: false, message: "Cafe24 OAuth 연결에 실패했습니다." },
      { status: 500 }
    );
  }
}
