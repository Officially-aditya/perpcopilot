import { NextResponse } from "next/server";
import { getNewsForAsset } from "../../../lib/news.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const asset = String(searchParams.get("asset") || "BTC").toUpperCase() === "ETH" ? "ETH" : "BTC";

  try {
    const news = await getNewsForAsset(asset);
    return NextResponse.json({
      success: true,
      data: news,
      meta: {
        asset,
        count: news.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      data: [],
      meta: {
        asset,
        count: 0,
        error: error.message,
      },
    });
  }
}
