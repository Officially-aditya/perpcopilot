import { NextResponse } from "next/server";
import { analyzeFunding } from "../../../lib/fundingAnalysis.js";
import { getMarketSnapshot } from "../../../lib/marketData.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildScanner(snapshot) {
  const assets = Object.values(snapshot.assets || {});
  if (!assets.length || !snapshot.assets.BTC || !snapshot.assets.ETH) {
    return [];
  }

  const analyzed = assets.map((market) => {
    const analysis = analyzeFunding(
      market.currentFundingRate,
      market.fundingHistory,
      snapshot.assets.BTC.currentFundingRate,
      snapshot.assets.ETH.currentFundingRate,
      market.priceHistory,
      {
        volume24h: market.volume24h,
        openInterest: market.openInterest,
      }
    );

    return {
      asset: market.asset,
      market,
      analysis,
    };
  });

  const strongestBullish = [...analyzed].sort(
    (left, right) => right.analysis.marketStructureScore - left.analysis.marketStructureScore
  )[0];
  const mostCrowdedLongs = [...analyzed].sort(
    (left, right) => right.market.currentFundingRate - left.market.currentFundingRate
  )[0];
  const carryDiscount = [...analyzed].sort(
    (left, right) => left.market.currentFundingRate - right.market.currentFundingRate
  )[0];
  const highestLiquidity = [...analyzed].sort(
    (left, right) => right.market.volume24h - left.market.volume24h
  )[0];

  const formatFunding = (rate) => `${rate > 0 ? "+" : ""}${(rate * 100).toFixed(3)}%`;
  const formatScore = (score) => `${score > 0 ? "+" : ""}${score}`;
  const formatCompact = (value) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  return [
    strongestBullish && {
      id: "strongest-structure",
      label: "Strongest Structure",
      asset: strongestBullish.asset,
      value: formatScore(strongestBullish.analysis.marketStructureScore),
      tone: strongestBullish.analysis.marketStructureScore >= 20 ? "bullish" : "neutral",
      detail: `${strongestBullish.analysis.marketBias} bias`,
      prompt: `Should I long ${strongestBullish.asset} right now?`,
    },
    mostCrowdedLongs && {
      id: "crowded-longs",
      label: "Most Crowded Longs",
      asset: mostCrowdedLongs.asset,
      value: formatFunding(mostCrowdedLongs.market.currentFundingRate),
      tone: "risk",
      detail: `${mostCrowdedLongs.analysis.percentile}th funding percentile`,
      prompt: `Is ${mostCrowdedLongs.asset} overleveraged right now?`,
    },
    carryDiscount && {
      id: "carry-discount",
      label: "Best Carry Discount",
      asset: carryDiscount.asset,
      value: formatFunding(carryDiscount.market.currentFundingRate),
      tone: carryDiscount.market.currentFundingRate < 0 ? "bullish" : "neutral",
      detail: `${carryDiscount.analysis.marketBias} structure`,
      prompt: `What does the funding rate tell me about ${carryDiscount.asset}?`,
    },
    highestLiquidity && {
      id: "highest-liquidity",
      label: "Highest Liquidity",
      asset: highestLiquidity.asset,
      value: formatCompact(highestLiquidity.market.volume24h),
      tone: "info",
      detail: `${formatCompact(highestLiquidity.market.openInterest)} OI`,
      prompt: `How is ${highestLiquidity.asset} positioned right now?`,
    },
  ].filter(Boolean);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const asset = String(searchParams.get("asset") || "").toUpperCase();
    const snapshot = await getMarketSnapshot();
    const scanner = buildScanner(snapshot);

    const data = asset
      ? snapshot.assets[asset]
      : {
          ...snapshot,
          scanner,
        };

    return NextResponse.json({
      success: true,
      data,
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
