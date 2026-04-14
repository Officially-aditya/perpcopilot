import { NextResponse } from "next/server";
import { getMarketSnapshot } from "../../../lib/marketData.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const asset = String(searchParams.get("asset") || "").toUpperCase();
    const snapshot = await getMarketSnapshot();

    return NextResponse.json({
      success: true,
      data: asset ? snapshot.assets[asset] : snapshot,
      meta: snapshot.meta,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
