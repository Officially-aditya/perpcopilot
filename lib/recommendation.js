import "server-only";

function resolveOxloApiBase() {
  return (process.env.OXLO_API_BASE || "https://api.oxlo.ai/v1").replace(/\/$/, "");
}

const OXLO_CHAT_COMPLETIONS_URL = `${resolveOxloApiBase()}/chat/completions`;
const DEFAULT_OXLO_MODEL = "deepseek-v3.2";
const DEFAULT_OXLO_TIMEOUT_MS = 35000;

export const PERP_COPILOT_SYSTEM_PROMPT = `You are PerpCopilot, an expert perpetual futures trading analyst.
You receive real market data, quantitative analysis, and recent news.
Your job is to answer the user's trading question with depth and clarity.

Questions may fall into either of these modes:
- trade-entry mode: the user is asking whether to initiate or avoid a long/short perp trade
- position-management mode: the user already holds exposure and is asking whether to hold, sell, reduce, or add

Choose the recommendation label that matches the user's intent. Use trade-entry labels for trade-entry questions and position-management labels for ownership/management questions.
If the user is asking whether to sell or keep an existing holding, do not answer with LONG, SHORT, or AVOID. Use HOLD, SELL, or REDUCE unless the user explicitly asks whether they should add more.
Funding rate is only one input. You must weigh price trend, volatility, liquidity/open-interest structure, and market regime alongside funding.

Respond ONLY in this exact JSON structure:
{
  "recommendation": "LONG" | "SHORT" | "AVOID" | "HOLD" | "SELL" | "REDUCE" | "BUY",
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

export const COPILOT_EXPLAINER_SYSTEM_PROMPT = `You are PerpCopilot, an expert crypto and perpetual futures copilot.
You answer trader, infrastructure, market-structure, and asset-explainer questions clearly and directly.

If live market context is provided, use it as supporting context rather than forcing a trade recommendation.

Respond ONLY in this exact JSON structure:
{
  "title": "short title for the answer",
  "summary": "3-5 sentence direct answer to the user's question",
  "key_points": ["point 1", "point 2", "point 3"],
  "market_hook": "one sentence connecting the answer to the current live market context, or null if not relevant",
  "follow_ups": ["useful follow-up question 1", "useful follow-up question 2", "useful follow-up question 3"]
}

Avoid fluff. Be accurate. If the question is broad or educational, answer it plainly before adding market context.`;

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

function formatOneDecimal(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function describeMarketRegime(analysis) {
  if (analysis.marketRegime === "trend_up") return "an uptrend";
  if (analysis.marketRegime === "trend_down") return "a downtrend";
  return "a range-bound regime";
}

function describeVolatility(analysis) {
  if (analysis.volatilityRegime === "elevated") return "elevated volatility";
  if (analysis.volatilityRegime === "compressed") return "compressed volatility";
  return "normal volatility";
}

const TRADE_ENTRY_RECOMMENDATIONS = ["LONG", "SHORT", "AVOID", "HOLD"];
const POSITION_MANAGEMENT_RECOMMENDATIONS = ["BUY", "SELL", "REDUCE", "HOLD"];

function normalizeRecommendationValue(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return [...TRADE_ENTRY_RECOMMENDATIONS, ...POSITION_MANAGEMENT_RECOMMENDATIONS].includes(normalized)
    ? normalized
    : null;
}

function normalizeConfidenceValue(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return ["LOW", "MEDIUM", "HIGH"].includes(normalized) ? normalized : null;
}

function getAllowedRecommendations(queryIntent, positionActionHint) {
  if (queryIntent !== "position_management") {
    return TRADE_ENTRY_RECOMMENDATIONS;
  }

  if (positionActionHint === "buy") {
    return POSITION_MANAGEMENT_RECOMMENDATIONS;
  }

  return ["SELL", "REDUCE", "HOLD"];
}

function normalizeOxloRecommendation(payload, queryIntent, positionActionHint) {
  if (!payload || typeof payload !== "object") return null;

  const recommendation = normalizeRecommendationValue(payload.recommendation);
  const confidence = normalizeConfidenceValue(payload.confidence);
  const allowedRecommendations = getAllowedRecommendations(queryIntent, positionActionHint);
  const riskFactors = Array.isArray(payload.risk_factors)
    ? payload.risk_factors.filter((item) => typeof item === "string" && item.trim())
    : [];

  if (
    !recommendation ||
    !allowedRecommendations.includes(recommendation) ||
    !confidence ||
    typeof payload.summary !== "string" ||
    typeof payload.funding_rate_insight !== "string" ||
    typeof payload.divergence_insight !== "string" ||
    typeof payload.cross_asset_insight !== "string" ||
    typeof payload.market_context !== "string" ||
    typeof payload.time_horizon !== "string" ||
    typeof payload.chart_annotation !== "string" ||
    riskFactors.length < 3
  ) {
    return null;
  }

  return {
    recommendation,
    confidence,
    summary: payload.summary.trim(),
    funding_rate_insight: payload.funding_rate_insight.trim(),
    divergence_insight: payload.divergence_insight.trim(),
    cross_asset_insight: payload.cross_asset_insight.trim(),
    risk_factors: riskFactors.slice(0, 3),
    market_context: payload.market_context.trim(),
    suggested_entry:
      typeof payload.suggested_entry === "string" && payload.suggested_entry.trim()
        ? payload.suggested_entry.trim()
        : null,
    suggested_stop_loss:
      typeof payload.suggested_stop_loss === "string" && payload.suggested_stop_loss.trim()
        ? payload.suggested_stop_loss.trim()
        : null,
    time_horizon: payload.time_horizon.trim(),
    chart_annotation: payload.chart_annotation.trim(),
  };
}

function normalizeExplainerPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const keyPoints = Array.isArray(payload.key_points)
    ? payload.key_points.filter((item) => typeof item === "string" && item.trim()).slice(0, 4)
    : [];
  const followUps = Array.isArray(payload.follow_ups)
    ? payload.follow_ups.filter((item) => typeof item === "string" && item.trim()).slice(0, 4)
    : [];

  if (
    typeof payload.title !== "string" ||
    typeof payload.summary !== "string" ||
    keyPoints.length < 2
  ) {
    return null;
  }

  return {
    title: payload.title.trim(),
    summary: payload.summary.trim(),
    key_points: keyPoints,
    market_hook:
      typeof payload.market_hook === "string" && payload.market_hook.trim()
        ? payload.market_hook.trim()
        : null,
    follow_ups: followUps,
  };
}

function parseStructuredText(text, normalizer) {
  try {
    return normalizer(JSON.parse(text));
  } catch (_error) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return normalizer(JSON.parse(jsonMatch[0]));
  }
}

export function detectIntent(query) {
  const normalizedQuery = String(query || "").toLowerCase();

  const positionManagementSignals = [
    "should i sell",
    "should i hold",
    "should i keep",
    "should i reduce",
    "should i trim",
    "should i exit",
    "should i close",
    "take profit",
    "lock in profit",
    "i have ",
    "i hold ",
    "my position",
    "my btc",
    "my eth",
    "held",
    "holding",
    "bag",
  ];

  return positionManagementSignals.some((signal) => normalizedQuery.includes(signal))
    ? "position_management"
    : "trade_entry";
}

export function detectPositionActionHint(query) {
  const normalizedQuery = String(query || "").toLowerCase();

  if (
    normalizedQuery.includes("buy more") ||
    normalizedQuery.includes("add more") ||
    normalizedQuery.includes("add to") ||
    normalizedQuery.includes("accumulate")
  ) {
    return "buy";
  }

  if (
    normalizedQuery.includes("sell") ||
    normalizedQuery.includes("exit") ||
    normalizedQuery.includes("close") ||
    normalizedQuery.includes("take profit")
  ) {
    return "sell";
  }

  if (
    normalizedQuery.includes("reduce") ||
    normalizedQuery.includes("trim") ||
    normalizedQuery.includes("de-risk")
  ) {
    return "reduce";
  }

  if (
    normalizedQuery.includes("hold") ||
    normalizedQuery.includes("keep")
  ) {
    return "hold";
  }

  return "generic";
}

export function detectQueryMode(query) {
  const normalizedQuery = String(query || "").toLowerCase().trim();

  const marketSignals = [
    "should i",
    "funding",
    "position",
    "long",
    "short",
    "sell",
    "buy",
    "reduce",
    "hold",
    "trade",
    "perp",
    "perpetual",
    "entry",
    "exit",
    "overleveraged",
    "crowded",
    "risk",
    "setup",
    "price",
    "momentum",
    "support",
    "resistance",
    "open interest",
  ];

  const explainerSignals = [
    "what is",
    "who is",
    "how does",
    "how do",
    "why does",
    "why is",
    "explain",
    "define",
    "tell me about",
    "difference between",
    "compare ",
  ];

  if (marketSignals.some((signal) => normalizedQuery.includes(signal))) {
    return "market_analysis";
  }

  if (explainerSignals.some((signal) => normalizedQuery.startsWith(signal) || normalizedQuery.includes(signal))) {
    return "explainer";
  }

  return "explainer";
}

function getOxloTimeoutMs() {
  const configured = Number(process.env.OXLO_TIMEOUT_MS || DEFAULT_OXLO_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 5000
    ? configured
    : DEFAULT_OXLO_TIMEOUT_MS;
}

async function requestOxloCompletion({ systemPrompt, payload, maxTokens, timeoutMs }) {
  const response = await fetch(OXLO_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OXLO_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OXLO_MODEL || DEFAULT_OXLO_MODEL,
      max_tokens: maxTokens,
      temperature: 0.2,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Oxlo request failed: ${response.status}`);
  }

  return response.json();
}

export function detectAsset(query, explicitAsset) {
  const explicit = String(explicitAsset || "").trim();
  if (explicit) {
    return explicit;
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
  queryIntent,
  positionActionHint,
  asset,
  market,
  comparison,
  analysis,
  news,
}) {
  const currentRatePct = market.currentFundingRate * 100;
  const structureScore = analysis.marketStructureScore ?? 0;
  const crowdedAsset =
    analysis.crossAssetSignal === "btc_more_crowded"
      ? "BTC"
      : analysis.crossAssetSignal === "eth_more_crowded"
        ? "ETH"
        : "neither asset";
  const benchmarkFundingRate =
    asset === "BTC" || asset === "ETH"
      ? asset === "BTC"
        ? comparison.ETH.currentFundingRate
        : comparison.BTC.currentFundingRate
      : (comparison.BTC.currentFundingRate + comparison.ETH.currentFundingRate) / 2;
  const benchmarkLabel =
    asset === "BTC" || asset === "ETH" ? (asset === "BTC" ? "ETH" : "BTC") : "BTC/ETH benchmark";
  const relativeCrowding =
    market.currentFundingRate - benchmarkFundingRate > 0.00012
      ? `${asset} is more crowded than ${benchmarkLabel}`
      : benchmarkFundingRate - market.currentFundingRate > 0.00012
        ? `${asset} is less crowded than ${benchmarkLabel}`
        : `${asset} and ${benchmarkLabel} are similarly positioned`;

  let recommendation = "HOLD";
  if (queryIntent === "position_management") {
    if (structureScore <= -45) {
      recommendation = "SELL";
    } else if (structureScore <= -20) {
      recommendation = "REDUCE";
    } else if (
      positionActionHint === "buy" &&
      structureScore >= 35
    ) {
      recommendation = "BUY";
    } else if (
      positionActionHint === "sell" &&
      structureScore >= 10
    ) {
      recommendation = "HOLD";
    }
  } else if (structureScore >= 35) {
    recommendation = "LONG";
  } else if (structureScore <= -45) {
    recommendation = "SHORT";
  } else if (structureScore <= -20 || Math.abs(structureScore) < 15) {
    recommendation = "AVOID";
  }

  const confidence =
    recommendation === "HOLD"
      ? Math.abs(structureScore) >= 25 ? "HIGH" : "MEDIUM"
      : Math.abs(structureScore) >= 45
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
  const historicalInsight = comparisonsSummary
    ? `The three closest prior readings behaved like this: ${comparisonsSummary}.`
    : "There were no close historical analogs in the current 30-day sample.";

  const headlineContext = news.length
    ? `Recent coverage is led by "${news[0].title}" and ${news.length - 1} other headlines that could shift positioning quickly.`
    : "No fresh Brave headlines were available, so the call leans entirely on Pacifica positioning and price action.";
  const carryInsight =
    currentRatePct > 0.005
      ? "That means longs are paying noticeable carry right now."
      : currentRatePct < -0.005
        ? "That means shorts are paying noticeable carry right now, which slightly eases the pressure on longs."
        : "That leaves carry close to neutral right now.";
  const regimeInsight = `${asset} is trading in ${describeMarketRegime(analysis)} with ${describeVolatility(
    analysis
  )}. Price is ${formatOneDecimal(analysis.momentum7dPct)}% over 7 days and ${formatOneDecimal(
    analysis.momentum30dPct
  )}% over 30 days, while spot sits ${formatOneDecimal(
    analysis.distanceFromMa30Pct
  )}% versus the 30-day average.`;
  const liquidityInsight = `24h volume is ${formatLargeNumber(
    market.volume24h
  )} against ${formatLargeNumber(
    market.openInterest
  )} of open interest, which screens as a ${analysis.liquidityRegime} liquidity backdrop with ${analysis.crowdingRegime} positioning.`;

  const entryOffset = market.currentPrice * 0.004;
  const stopOffset = market.currentPrice * 0.022;

  const suggestedEntry = queryIntent === "position_management"
    ? recommendation === "SELL"
      ? `${formatCompactUsd(market.currentPrice - entryOffset)} - ${formatCompactUsd(
          market.currentPrice
        )}`
      : recommendation === "REDUCE"
        ? `${formatCompactUsd(market.currentPrice)} - ${formatCompactUsd(
            market.currentPrice + entryOffset
          )}`
        : recommendation === "BUY"
          ? `${formatCompactUsd(market.currentPrice - entryOffset * 1.8)} - ${formatCompactUsd(
              market.currentPrice - entryOffset
            )}`
          : null
    : recommendation === "AVOID"
      ? null
      : recommendation === "SHORT"
        ? `${formatCompactUsd(market.currentPrice + entryOffset)} - ${formatCompactUsd(
            market.currentPrice + entryOffset * 1.8
          )}`
        : `${formatCompactUsd(market.currentPrice - entryOffset * 1.8)} - ${formatCompactUsd(
            market.currentPrice - entryOffset
          )}`;

  const suggestedStopLoss = queryIntent === "position_management"
    ? recommendation === "SELL" || recommendation === "REDUCE"
      ? formatCompactUsd(market.currentPrice + stopOffset * 0.6)
      : formatCompactUsd(market.currentPrice - stopOffset)
    : recommendation === "SHORT"
      ? formatCompactUsd(market.currentPrice + stopOffset)
      : formatCompactUsd(market.currentPrice - stopOffset);

  const summaryTail =
    queryIntent === "position_management"
      ? recommendation === "SELL"
        ? "For an existing holder, the broader market structure has deteriorated enough that de-risking makes more sense than waiting."
        : recommendation === "REDUCE"
          ? "For an existing position, the setup argues for trimming exposure rather than maintaining full size."
          : recommendation === "BUY"
            ? "For an existing holder, the broader structure is constructive enough that adding can be considered on weakness."
            : "For an existing holder, the broader market structure does not justify an urgent exit."
      : recommendation === "LONG"
        ? "The broader structure leans constructive enough for a directional long."
        : recommendation === "SHORT"
          ? "The broader structure leans weak enough for a directional short."
          : "The current mix of trend, volatility, and crowding does not create a clean entry edge.";

  const timeHorizon =
    queryIntent === "position_management"
      ? recommendation === "SELL"
        ? "Immediate to the next 24 hours if you want to de-risk into current liquidity."
        : recommendation === "REDUCE"
          ? "Over the next 1-2 sessions, trimming into strength or on failed bounces makes the most sense."
          : recommendation === "BUY"
            ? "Scale over 24 to 72 hours rather than adding all at once."
            : "24 to 72 hours, while you monitor whether funding and price action meaningfully change."
      : recommendation === "AVOID"
        ? "Wait for the next 1-2 funding windows to see if positioning cools before re-engaging."
        : "24 to 72 hours, long enough for the current funding extreme to mean-revert or confirm.";

  return {
    recommendation,
    confidence,
    summary: `${asset} is trading at ${formatCompactUsd(
      market.currentPrice
    )}. ${regimeInsight} Funding is ${currentRatePct.toFixed(3)}%, sitting in the ${
      analysis.percentile
    }th percentile over the past month, so it is a context signal rather than the whole trade thesis here. ${summaryTail}`,
    funding_rate_insight: `Funding is currently ${currentRatePct.toFixed(
      3
    )}%, above ${analysis.percentile}% of the past month and versus a 7-day average of ${analysis.avgLast7DaysPct.toFixed(
      3
    )}%. ${carryInsight} ${historicalInsight}`,
    divergence_insight: `Price moved ${formatSignedPct(
      analysis.priceChange24hPct
    )} over the last 24 hours while funding changed ${formatSignedPct(
      analysis.fundingChange24hPct
    )}. ${regimeInsight} That leaves the market in a ${analysis.divergence.toUpperCase()} state with ${
      analysis.divergenceSignal === "overleveraged_longs"
        ? "longs pressing into strength and increasing reversal risk."
        : analysis.divergenceSignal === "overleveraged_shorts"
          ? "shorts leaning too aggressively and leaving room for a squeeze."
          : "no clean one-way positioning signal yet."
    }`,
    cross_asset_insight: `${relativeCrowding}. BTC funding is ${formatFundingPct(
      comparison.BTC.currentFundingRate
    )} versus ETH at ${formatFundingPct(
      comparison.ETH.currentFundingRate
    )}. ${crowdedAsset === "neither asset" ? "The BTC/ETH benchmark pair is broadly balanced." : `${crowdedAsset} still carries the more crowded long book between the two majors.`}`,
    risk_factors: [
      `Trend risk: ${asset} is ${formatOneDecimal(analysis.distanceFromMa30Pct)}% versus its 30-day average with ${describeVolatility(
        analysis
      )}, so trend signals can fade quickly.`,
      `Positioning risk: funding is ${currentRatePct.toFixed(3)}% and in the ${analysis.percentile}th percentile, which still matters if crowding suddenly accelerates.`,
      `Liquidity risk: ${liquidityInsight}`,
    ],
    market_context: `${headlineContext} ${liquidityInsight} That means news is a catalyst layer on top of the prevailing market structure, not the sole driver of the call.`,
    suggested_entry: suggestedEntry,
    suggested_stop_loss: recommendation === "AVOID" ? null : suggestedStopLoss,
    time_horizon: timeHorizon,
    chart_annotation: `${asset} funding is in the ${analysis.percentile}th percentile, but the bigger read comes from the current ${analysis.marketBias} market-structure score of ${analysis.marketStructureScore}.`,
  };
}

export function buildFallbackExplainer({
  query,
  asset,
  market,
  analysis,
}) {
  const normalized = String(query || "").toLowerCase();
  const assetLabel = asset || "BTC";

  if (normalized.includes("what is btc")) {
    return {
      title: "Bitcoin Overview",
      summary: `BTC is the native asset of the Bitcoin network and the main benchmark asset for crypto markets. Traders watch BTC because it often sets the tone for risk appetite, liquidity, and derivatives positioning across the rest of the market. It matters here because Pacifica data can show not just BTC price, but also how perp traders are positioned around it right now.`,
      key_points: [
        "BTC is the largest and most liquid crypto asset.",
        "It often acts as the benchmark for overall crypto market direction.",
        "Perp traders watch BTC funding, open interest, and momentum for regime changes.",
      ],
      market_hook: market
        ? `On Pacifica right now, BTC is trading at ${formatCompactUsd(market.currentPrice)} with a ${analysis.marketBias} structure score of ${analysis.marketStructureScore}.`
        : null,
      follow_ups: [
        "What does BTC funding mean right now?",
        "Should I hold BTC or reduce exposure here?",
        "How is BTC different from ETH in perp positioning?",
      ],
    };
  }

  if (normalized.includes("funding rate")) {
    return {
      title: "Funding Rate Explained",
      summary: "Funding rate is the periodic payment exchanged between longs and shorts in perpetual futures so the perp price stays anchored near spot. Positive funding usually means longs are paying shorts, while negative funding usually means shorts are paying longs. It is useful as a positioning signal, especially at extremes, but it should be read together with price trend, volatility, and open interest.",
      key_points: [
        "Funding is a positioning signal rather than a standalone trade trigger.",
        "Extreme funding is more informative than mild funding.",
        "The best read comes from combining funding with price, volatility, and liquidity structure.",
      ],
      market_hook: market
        ? `${assetLabel} currently has funding at ${(market.currentFundingRate * 100).toFixed(3)}%, which is why PerpCopilot uses it as one input inside the broader structure score.`
        : null,
      follow_ups: [
        `What does the current ${assetLabel} funding mean?`,
        `Is ${assetLabel} crowded right now?`,
        "How should I combine funding with open interest?",
      ],
    };
  }

  if (normalized.includes("pacifica")) {
    return {
      title: "Pacifica Overview",
      summary: "Pacifica is a perpetual futures platform and builder stack that exposes live and historical market data plus trading APIs. This app uses Pacifica to pull mark prices, funding history, volume, and open interest so it can explain market structure instead of just displaying charts. That makes Pacifica the data backbone of the copilot rather than an optional integration.",
      key_points: [
        "Pacifica provides live and historical perpetual market data.",
        "Builders can use the APIs for dashboards, bots, analytics, and decision tools.",
        "PerpCopilot uses Pacifica market structure as the foundation of its analysis.",
      ],
      market_hook: market
        ? `${assetLabel} on Pacifica currently trades at ${formatCompactUsd(market.currentPrice)}, which is the kind of live context the app can layer into broader explanations.`
        : null,
      follow_ups: [
        "Which Pacifica endpoints does this app use?",
        "How does Pacifica funding history improve trade analysis?",
        "How does Pacifica compare BTC and ETH crowding?",
      ],
    };
  }

  return {
    title: `${titleCase(assetLabel)} Copilot Answer`,
    summary: "PerpCopilot can now handle both trade-analysis and explainer-style questions. For broader questions, it answers plainly first and then connects the explanation to current Pacifica market context when that context is relevant.",
    key_points: [
      "Use trade-style questions for entries, exits, positioning, and risk.",
      "Use explainer questions for assets, funding, open interest, and Pacifica concepts.",
      "Live market context can still be attached to broad answers when it helps.",
    ],
    market_hook: market
      ? `${assetLabel} currently screens ${analysis.marketBias} on the market-structure score, so even broader questions can be grounded in live context.`
      : null,
    follow_ups: [
      `What is ${assetLabel}?`,
      `What does ${assetLabel} funding mean right now?`,
      `Should I hold or reduce ${assetLabel}?`,
    ],
  };
}

export async function callOxlo(payload) {
  const apiKey = process.env.OXLO_API_KEY;
  if (!apiKey) return null;

  const timeoutMs = getOxloTimeoutMs();
  let result;

  try {
    result = await requestOxloCompletion({
      systemPrompt: PERP_COPILOT_SYSTEM_PROMPT,
      payload,
      maxTokens: 1200,
      timeoutMs,
    });
  } catch (error) {
    if (error?.name !== "TimeoutError") {
      throw error;
    }

    result = await requestOxloCompletion({
      systemPrompt: PERP_COPILOT_SYSTEM_PROMPT,
      payload,
      maxTokens: 700,
      timeoutMs: timeoutMs + 10000,
    });
  }

  const rawContent = result?.choices?.[0]?.message?.content;
  const text =
    typeof rawContent === "string"
      ? rawContent.trim()
      : Array.isArray(rawContent)
        ? rawContent
            .map((item) => (typeof item?.text === "string" ? item.text : ""))
            .join("")
            .trim()
        : "";
  if (!text) return null;

  return parseStructuredText(text, (parsed) =>
    normalizeOxloRecommendation(parsed, payload.queryIntent, payload.positionActionHint)
  );
}

export async function callOxloExplainer(payload) {
  const apiKey = process.env.OXLO_API_KEY;
  if (!apiKey) return null;

  const timeoutMs = getOxloTimeoutMs();
  let result;

  try {
    result = await requestOxloCompletion({
      systemPrompt: COPILOT_EXPLAINER_SYSTEM_PROMPT,
      payload,
      maxTokens: 900,
      timeoutMs,
    });
  } catch (error) {
    if (error?.name !== "TimeoutError") {
      throw error;
    }

    result = await requestOxloCompletion({
      systemPrompt: COPILOT_EXPLAINER_SYSTEM_PROMPT,
      payload,
      maxTokens: 600,
      timeoutMs: timeoutMs + 8000,
    });
  }

  const rawContent = result?.choices?.[0]?.message?.content;
  const text =
    typeof rawContent === "string"
      ? rawContent.trim()
      : Array.isArray(rawContent)
        ? rawContent
            .map((item) => (typeof item?.text === "string" ? item.text : ""))
            .join("")
            .trim()
        : "";
  if (!text) return null;

  return parseStructuredText(text, normalizeExplainerPayload);
}
