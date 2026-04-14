import { NextResponse } from "next/server";
import { analyzeFunding } from "../../../lib/fundingAnalysis.js";
import { getMarketSnapshot } from "../../../lib/marketData.js";
import { getNewsForAsset } from "../../../lib/news.js";
import {
  buildFallbackRecommendation,
  buildFallbackExplainer,
  buildMergedHistory,
  callOxlo,
  callOxloExplainer,
  detectAsset,
  detectIntent,
  detectPositionActionHint,
  detectQueryMode,
} from "../../../lib/recommendation.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUERY_CACHE_TTL_MS = 60 * 1000;
const queryCache = new Map();

function buildCacheKey({ query, asset, queryMode, queryIntent, sourceUpdatedAt }) {
  return JSON.stringify({
    query: query.toLowerCase(),
    asset,
    queryMode,
    queryIntent,
    sourceUpdatedAt,
  });
}

function getCachedQueryResult(cacheKey) {
  const cached = queryCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > QUERY_CACHE_TTL_MS) {
    queryCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCachedQueryResult(cacheKey, value) {
  queryCache.set(cacheKey, {
    cachedAt: Date.now(),
    value,
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const query = String(body?.query || "").trim();
    const asset = detectAsset(query, body?.asset);
    const queryMode = detectQueryMode(query);
    const queryIntent = detectIntent(query);
    const positionActionHint = detectPositionActionHint(query);

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
    const selectedAsset = snapshot.assets[asset]
      ? asset
      : snapshot.meta.availableAssets?.[0] || "BTC";
    const market = snapshot.assets[selectedAsset];
    const comparison = snapshot.assets;
    const analysis = analyzeFunding(
      market.currentFundingRate,
      market.fundingHistory,
      comparison.BTC.currentFundingRate,
      comparison.ETH.currentFundingRate,
      market.priceHistory,
      {
        volume24h: market.volume24h,
        openInterest: market.openInterest,
      }
    );

    let news = [];
    try {
      news = await getNewsForAsset(selectedAsset);
    } catch (error) {
      console.warn("News fetch failed", error.message);
    }

    const promptPayload = {
      query,
      asset: selectedAsset,
      queryMode,
      queryIntent,
      positionActionHint,
      market: {
        asset: market.asset,
        currentPrice: market.currentPrice,
        currentFundingRate: market.currentFundingRate,
        volume24h: market.volume24h,
        openInterest: market.openInterest,
      },
      comparison: {
        [selectedAsset]: {
          currentFundingRate: comparison[selectedAsset]?.currentFundingRate ?? market.currentFundingRate,
        },
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

    const cacheKey = buildCacheKey({
      query,
      asset: selectedAsset,
      queryMode,
      queryIntent,
      sourceUpdatedAt: snapshot.meta.updatedAt,
    });
    const cachedResult = getCachedQueryResult(cacheKey);
    if (cachedResult) {
      return NextResponse.json({
        success: true,
        data: cachedResult,
      });
    }

    let recommendation = null;
    let explainer = null;
    let aiSource = "heuristic";
    let aiError = null;

    try {
      if (queryMode === "market_analysis") {
        recommendation = await callOxlo(promptPayload);
      } else {
        explainer = await callOxloExplainer(promptPayload);
      }

      if (recommendation || explainer) {
        aiSource = "oxlo";
      } else {
        aiError = "Oxlo response did not match the required JSON schema.";
      }
    } catch (error) {
      aiError = error.message;
      console.warn("Oxlo call failed", error.message);
    }

    if (queryMode === "market_analysis" && !recommendation) {
      recommendation = buildFallbackRecommendation({
        queryIntent,
        positionActionHint,
        asset: selectedAsset,
        market,
        comparison,
        analysis,
        news,
      });
    }

    if (queryMode !== "market_analysis" && !explainer) {
      explainer = buildFallbackExplainer({
        query,
        asset: selectedAsset,
        market,
        analysis,
      });
    }

    const responseData = {
      query,
      asset: selectedAsset,
      queryMode,
      queryIntent,
      positionActionHint,
      market: {
        ...market,
        mergedHistory: buildMergedHistory(market, analysis),
      },
      comparison,
      analysis,
      recommendation,
      explainer,
      news,
      meta: {
        ...snapshot.meta,
        aiSource,
        aiModel: process.env.OXLO_MODEL || "deepseek-v3.2",
        aiError,
        newsAvailable: news.length > 0,
      },
    };

    setCachedQueryResult(cacheKey, responseData);

    return NextResponse.json({
      success: true,
      data: responseData,
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
