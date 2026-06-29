import { NextRequest, NextResponse } from "next/server";
import { getCafe24Config } from "@/lib/cafe24/config";
import { getValidCafe24AccessToken } from "@/lib/cafe24/token-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { mallId?: string };
    const config = getCafe24Config();

    await getValidCafe24AccessToken(body.mallId ?? config.mallId);

    return NextResponse.json({
      ok: true,
      message: "Cafe24 access token refresh check completed."
    });
  } catch (error) {
    console.error("cafe24_token_refresh_failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json(
      { ok: false, message: "Cafe24 token refresh failed. Please reconnect OAuth." },
      { status: 500 }
    );
  }
}
