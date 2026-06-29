import { NextResponse } from "next/server";
import { buildCafe24AuthorizeUrl, createOAuthState, setOAuthStateCookie } from "@/lib/cafe24/oauth";

export async function GET() {
  try {
    const state = createOAuthState();
    setOAuthStateCookie(state);

    return NextResponse.redirect(buildCafe24AuthorizeUrl(state));
  } catch (error) {
    console.error("cafe24_oauth_start_failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json(
      { ok: false, message: "Cafe24 OAuth 설정을 확인할 수 없습니다." },
      { status: 500 }
    );
  }
}
