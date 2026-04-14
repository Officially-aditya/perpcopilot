import "server-only";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export const CLAUDE_SYSTEM_PROMPT = `You are PerpCopilot, an expert perpetual futures trading analyst.
You receive real market data, quantitative analysis, and recent news.
Your job is to answer the user's trading question with depth and clarity.

Respond ONLY in this exact JSON structure:
{
  "recommendation": "LONG" | "SHORT" | "AVOID" | "HOLD",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "summary": "3-4 sentence plain English summary referencing the specific data points",
  "funding_rate_insight": "Plain English explanation of what the current funding rate AND its percentile means. Reference the historical comparisons — e.g. last 3 times funding was this high, price did X",
  "divergence_insight": "Explain the price/funding divergence signal in plain English. What does it mean for the trade?",
  "cross_asset_insight": "Compare BTC vs ETH positioning. Which is more crowded? Does this affect the trade?",
  "risk_factors": ["specific risk 1 with data", "specific risk 2 with data", "specific risk 3 with data"],
  "market_context": "How does the news context affect this trade?",
  "suggested_entry": "price or range, or null if AVOID",
  "suggested_stop_loss": "price level based on volatility",
  "time_horizon": "suggested holding period with reasoning",
  "chart_annotation": "One key sentence to display as annotation on the funding rate chart at the current reading"
}

Be direct. Reference actual numbers. No generic disclaimers. Treat user as experienced trader.`;

function formatFundingPct(rate) {
  return `${(rate * 100).toFixed(3)}%`;
}

function formatSignedPct(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatCompactUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatLargeNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function detectAsset(query, explicitAsset) {
  const normalizedExplicit = String(explicitAsset || "").toUpperCase();
  if (normalizedExplicit === "BTC" || normalizedExplicit === "ETH") {
    return normalizedExplicit;
  }

  const normalizedQuery = String(query || "").toUpperCase();
  if (normalizedQuery.includes("ETH") || normalizedQuery.includes("ETHER")) {
    return "ETH";
  }
  return "BTC";
}

export function buildMergedHistory(assetData, analysis) {
  return assetData.priceHistory.map((pricePoint) => {
    const fundingPoint = assetData.fundingHistory.find(
      (point) => point.timestamp === pricePoint.timestamp
    );

    return {
      timestamp: pricePoint.timestamp,
      label: pricePoint.label,
      price: pricePoint.price,
      rate: fundingPoint?.rate ?? 0,
      ratePct: fundingPoint?.ratePct ?? 0,
    };
  });
}

export function buildFallbackRecommendation({
  asset,
  market,
  comparison,
  analysis,
  news,
}) {
  const currentRatePct = market.currentFundingRate * 100;
  const crowdedAsset =
    analysis.crossAssetSignal === "btc_more_crowded"
      ? "BTC"
      : analysis.crossAssetSignal === "eth_more_crowded"
        ? "ETH"
        : "neither asset";

  let recommendation = "HOLD";
  if (
    analysis.divergenceSignal === "overleveraged_longs" &&
    analysis.percentile >= 75
  ) {
    recommendation = currentRatePct >= 0.08 ? "SHORT" : "AVOID";
  } else if (
    analysis.divergenceSignal === "overleveraged_shorts" &&
    analysis.percentile <= 25
  ) {
    recommendation = "LONG";
  } else if (analysis.percentile >= 88) {
    recommendation = "AVOID";
  } else if (analysis.percentile <= 18 && currentRatePct < 0) {
    recommendation = "LONG";
  }

  const confidence =
    recommendation === "HOLD"
      ? "MEDIUM"
      : analysis.percentile >= 85 || analysis.percentile <= 15
        ? "HIGH"
        : "MEDIUM";

  const comparisonsSummary = analysis.historicalComparisons
    .map(
      (item) =>
        `${item.date}: ${formatSignedPct(item.after24hPct)} after 24h, ${formatSignedPct(
          item.after48hPct
        )} after 48h, ${formatSignedPct(item.after72hPct)} after 72h`
    )
    .join("; ");

  const headlineContext = news.length
    ? `Recent coverage is led by "${news[0].title}" and ${news.length - 1} other headlines that could shift positioning quickly.`
    : "No fresh Brave headlines were available, so the call leans entirely on Pacifica positioning and price action.";

  const entryOffset = market.currentPrice * 0.004;
  const stopOffset = market.currentPrice * 0.022;

  const suggestedEntry =
    recommendation === "AVOID"
      ? null
      : recommendation === "SHORT"
        ? `${formatCompactUsd(market.currentPrice + entryOffset)} - ${formatCompactUsd(
            market.currentPrice + entryOffset * 1.8
          )}`
        : `${formatCompactUsd(market.currentPrice - entryOffset * 1.8)} - ${formatCompactUsd(
            market.currentPrice - entryOffset
          )}`;

  const suggestedStopLoss =
    recommendation === "SHORT"
      ? formatCompactUsd(market.currentPrice + stopOffset)
      : formatCompactUsd(market.currentPrice - stopOffset);

  return {
    recommendation,
    confidence,
    summary: `${asset} is trading at ${formatCompactUsd(
      market.currentPrice
    )} with funding at ${currentRatePct.toFixed(3)}%, which places the current reading in the ${
      analysis.percentile
    }th percentile of the last 30 days. The 7-day average sits at ${analysis.avgLast7DaysPct.toFixed(
      3
    )}%, while 24-hour price action is ${formatSignedPct(
      analysis.priceChange24hPct
    )}. ${analysis.divergenceSignal === "overleveraged_longs" ? "Positioning looks stretched on the long side." : analysis.divergenceSignal === "overleveraged_shorts" ? "Short positioning looks crowded enough to squeeze." : "Positioning is elevated but not yet at a washout extreme."}`,
    funding_rate_insight: `Funding is currently ${currentRatePct.toFixed(
      3
    )}%, above ${analysis.percentile}% of the past month and versus a 7-day average of ${analysis.avgLast7DaysPct.toFixed(
      3
    )}%. That tells you carry is expensive for longs right now. The three closest prior readings behaved like this: ${comparisonsSummary}.`,
    divergence_insight: `Price moved ${formatSignedPct(
      analysis.priceChange24hPct
    )} over the last 24 hours while funding changed ${formatSignedPct(
      analysis.fundingChange24hPct
    )}. That leaves the market in a ${analysis.divergence.toUpperCase()} state with ${
      analysis.divergenceSignal === "overleveraged_longs"
        ? "longs pressing into strength and increasing reversal risk."
        : analysis.divergenceSignal === "overleveraged_shorts"
          ? "shorts leaning too aggressively and leaving room for a squeeze."
          : "no clean one-way positioning signal yet."
    }`,
    cross_asset_insight: `${crowdedAsset === "neither asset" ? "BTC and ETH funding are broadly balanced." : `${crowdedAsset} is carrying the more crowded long book right now.`} BTC funding is ${formatFundingPct(
      comparison.BTC.currentFundingRate
    )} versus ETH at ${formatFundingPct(
      comparison.ETH.currentFundingRate
    )}, a spread of ${analysis.crossAssetSpreadPct.toFixed(3)} percentage points.`,
    risk_factors: [
      `Carry risk: holding the position into the next funding windows means paying ${currentRatePct.toFixed(
        3
      )}% every cycle at current rates.`,
      `Reversal risk: the last 24h move is ${formatSignedPct(
        analysis.priceChange24hPct
      )}, so crowded positioning can unwind violently.`,
      `Liquidity gap risk: ${asset} open interest is ${formatLargeNumber(
        market.openInterest
      )} and 24h volume is ${formatLargeNumber(market.volume24h)}, so fast squeezes can still gap entries around macro headlines.`,
    ],
    market_context: `${headlineContext} That means news should be treated as a catalyst layer, not the core signal, unless a fresh market-moving headline lands during the next funding window.`,
    suggested_entry: suggestedEntry,
    suggested_stop_loss: recommendation === "AVOID" ? null : suggestedStopLoss,
    time_horizon:
      recommendation === "AVOID"
        ? "Wait for the next 1-2 funding windows to see if positioning cools before re-engaging."
        : "24 to 72 hours, long enough for the current funding extreme to mean-revert or confirm.",
    chart_annotation: `${asset} funding is sitting in the ${analysis.percentile}th percentile, so the carry regime is meaningfully stretched versus the last month.`,
  };
}

export async function callClaude(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 1200,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed: ${response.status}`);
  }

  const result = await response.json();
  const text = result?.content?.[0]?.text?.trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_error) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  }
}
