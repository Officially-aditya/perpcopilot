import { NextResponse } from "next/server";
import { analyzeFunding } from "../../../lib/fundingAnalysis.js";
import { getMarketSnapshot } from "../../../lib/marketData.js";
import { getNewsForAsset } from "../../../lib/news.js";
import {
  buildFallbackRecommendation,
  buildMergedHistory,
  callClaude,
  detectAsset,
} from "../../../lib/recommendation.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const query = String(body?.query || "").trim();
    const asset = detectAsset(query, body?.asset);

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "Query is required",
        },
        { status: 400 }
      );
    }

    const snapshot = await getMarketSnapshot();
    const market = snapshot.assets[asset];
    const comparison = snapshot.assets;
    const analysis = analyzeFunding(
      market.currentFundingRate,
      market.fundingHistory,
      comparison.BTC.currentFundingRate,
      comparison.ETH.currentFundingRate,
      market.priceHistory
    );

    let news = [];
    try {
      news = await getNewsForAsset(asset);
    } catch (error) {
      console.warn("News fetch failed", error.message);
    }

    const promptPayload = {
      query,
      asset,
      market: {
        asset: market.asset,
        currentPrice: market.currentPrice,
        currentFundingRate: market.currentFundingRate,
        volume24h: market.volume24h,
        openInterest: market.openInterest,
      },
      comparison: {
        BTC: {
          currentFundingRate: comparison.BTC.currentFundingRate,
        },
        ETH: {
          currentFundingRate: comparison.ETH.currentFundingRate,
        },
      },
      analysis,
      news,
    };

    let recommendation = null;
    let aiSource = "heuristic";

    try {
      recommendation = await callClaude(promptPayload);
      if (recommendation) {
        aiSource = "claude";
      }
    } catch (error) {
      console.warn("Claude call failed", error.message);
    }

    if (!recommendation) {
      recommendation = buildFallbackRecommendation({
        asset,
        market,
        comparison,
        analysis,
        news,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        query,
        asset,
        market: {
          ...market,
          mergedHistory: buildMergedHistory(market, analysis),
        },
        comparison,
        analysis,
        recommendation,
        news,
        meta: {
          ...snapshot.meta,
          aiSource,
          newsAvailable: news.length > 0,
        },
      },
    });
  } catch (error) {
    console.error("Query route failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to generate trade analysis right now.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
