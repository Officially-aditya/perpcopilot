const DAY_MS = 24 * 60 * 60 * 1000;

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pctChange(from, to) {
  if (!Number.isFinite(from) || from === 0 || !Number.isFinite(to)) return 0;
  return ((to - from) / from) * 100;
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const clamped = clamp(q, 0, 1);
  const index = (sortedValues.length - 1) * clamped;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sortedValues[low];
  const weight = index - low;
  return sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
}

function toLabel(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function buildMergedSeries(prices, historicalRates) {
  const rateByTimestamp = new Map(
    historicalRates.map((point) => [point.timestamp, point.rate])
  );

  return prices
    .map((point) => {
      const rate = rateByTimestamp.get(point.timestamp);
      if (!Number.isFinite(rate)) return null;

      return {
        timestamp: point.timestamp,
        label: point.label || toLabel(point.timestamp),
        price: point.price,
        rate,
        ratePct: rate * 100,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function deriveTrend(historicalRates) {
  const ordered = [...historicalRates].sort((a, b) => a.timestamp - b.timestamp);
  const recent = ordered.slice(-3).map((point) => point.rate);
  const prior = ordered.slice(-6, -3).map((point) => point.rate);
  const delta = average(recent) - average(prior);

  if (delta > 0.00008) return "rising";
  if (delta < -0.00008) return "falling";
  return "stable";
}

function movingAverage(values, period) {
  if (!values.length) return 0;
  const sample = values.slice(-period);
  return average(sample);
}

function derivePriceStructure(prices) {
  const ordered = [...prices].sort((a, b) => a.timestamp - b.timestamp);
  const current = ordered.at(-1)?.price ?? 0;
  const prev1d = ordered.at(-2)?.price ?? current;
  const prev7d = ordered.at(-8)?.price ?? ordered[0]?.price ?? current;
  const prev30d = ordered[0]?.price ?? current;
  const priceValues = ordered.map((point) => point.price);
  const returns = ordered.slice(1).map((point, index) => pctChange(ordered[index].price, point.price));
  const ma7 = movingAverage(priceValues, 7);
  const ma30 = movingAverage(priceValues, 30);
  const monthHigh = Math.max(...priceValues);
  const monthLow = Math.min(...priceValues);
  const rangeWidth = monthHigh - monthLow;

  const momentum1dPct = pctChange(prev1d, current);
  const momentum7dPct = pctChange(prev7d, current);
  const momentum30dPct = pctChange(prev30d, current);
  const distanceFromMa7Pct = pctChange(ma7, current);
  const distanceFromMa30Pct = pctChange(ma30, current);
  const realizedVolatility7dPct = standardDeviation(returns.slice(-7));
  const realizedVolatility30dPct = standardDeviation(returns);
  const priceRangePositionPct = rangeWidth > 0 ? ((current - monthLow) / rangeWidth) * 100 : 50;

  let priceTrend = "sideways";
  if (momentum7dPct >= 2 && distanceFromMa7Pct >= 0) {
    priceTrend = "up";
  } else if (momentum7dPct <= -2 && distanceFromMa7Pct <= 0) {
    priceTrend = "down";
  }

  let volatilityRegime = "normal";
  if (realizedVolatility7dPct >= 4 || realizedVolatility30dPct >= 3.5) {
    volatilityRegime = "elevated";
  } else if (realizedVolatility7dPct <= 1.5 && realizedVolatility30dPct <= 2) {
    volatilityRegime = "compressed";
  }

  let marketRegime = "range";
  if (priceTrend === "up" && momentum30dPct >= 4) {
    marketRegime = "trend_up";
  } else if (priceTrend === "down" && momentum30dPct <= -4) {
    marketRegime = "trend_down";
  }

  return {
    momentum1dPct,
    momentum7dPct,
    momentum30dPct,
    distanceFromMa7Pct,
    distanceFromMa30Pct,
    realizedVolatility7dPct,
    realizedVolatility30dPct,
    volatilityRegime,
    priceTrend,
    marketRegime,
    priceRangePositionPct,
    monthHigh,
    monthLow,
    ma7,
    ma30,
  };
}

function deriveLiquidityContext(volume24h, openInterest) {
  const volumeToOiRatio = openInterest > 0 ? volume24h / openInterest : 0;
  const oiToVolumeRatio = volume24h > 0 ? openInterest / volume24h : 0;

  let liquidityRegime = "balanced";
  if (volumeToOiRatio >= 1.4) {
    liquidityRegime = "liquid";
  } else if (volumeToOiRatio <= 0.8) {
    liquidityRegime = "thin";
  }

  let crowdingRegime = "balanced";
  if (oiToVolumeRatio >= 1.1) {
    crowdingRegime = "crowded";
  } else if (oiToVolumeRatio <= 0.5) {
    crowdingRegime = "uncrowded";
  }

  return {
    volumeToOiRatio,
    oiToVolumeRatio,
    liquidityRegime,
    crowdingRegime,
  };
}

function deriveMarketStructureScore({
  currentRate,
  percentile,
  divergenceSignal,
  priceStructure,
  liquidityContext,
}) {
  let score = 0;

  score += clamp(priceStructure.momentum7dPct * 3, -18, 18);
  score += clamp(priceStructure.momentum30dPct * 2, -20, 20);
  score += clamp(priceStructure.distanceFromMa30Pct * 2.5, -12, 12);

  if (priceStructure.marketRegime === "trend_up") score += 8;
  if (priceStructure.marketRegime === "trend_down") score -= 8;

  if (divergenceSignal === "overleveraged_longs") score -= 20;
  if (divergenceSignal === "overleveraged_shorts") score += 20;

  if (currentRate > 0 && percentile >= 85) score -= 12;
  if (currentRate < 0 && percentile <= 15) score += 12;

  if (priceStructure.volatilityRegime === "elevated") score -= 8;
  if (priceStructure.volatilityRegime === "compressed") score += 4;

  if (liquidityContext.liquidityRegime === "liquid") score += 4;
  if (liquidityContext.liquidityRegime === "thin") score -= 6;

  if (liquidityContext.crowdingRegime === "crowded") score -= 4;

  const normalizedScore = Math.round(clamp(score, -100, 100));

  let bias = "neutral";
  if (normalizedScore >= 20) {
    bias = "bullish";
  } else if (normalizedScore <= -20) {
    bias = "bearish";
  }

  return {
    marketStructureScore: normalizedScore,
    marketBias: bias,
  };
}

function detectDivergence(mergedSeries) {
  const latest = mergedSeries.at(-1);
  const previous24h = mergedSeries.at(-2);
  const previous72h = mergedSeries.at(-4);
  const currentRate = latest?.rate ?? 0;

  const priceChange24hPct = previous24h
    ? pctChange(previous24h.price, latest.price)
    : 0;
  const priceChange72hPct = previous72h
    ? pctChange(previous72h.price, latest.price)
    : 0;
  const fundingChange24hPct = previous24h
    ? (latest.rate - previous24h.rate) * 100
    : 0;

  let divergence = "aligned";
  let divergenceSignal = "neutral";

  if (
    priceChange24hPct >= 5 &&
    (currentRate >= 0.0006 || fundingChange24hPct >= 0.02)
  ) {
    divergence = "diverging";
    divergenceSignal = "overleveraged_longs";
  } else if (
    priceChange24hPct <= -5 &&
    (currentRate <= -0.0006 || fundingChange24hPct <= -0.02)
  ) {
    divergence = "diverging";
    divergenceSignal = "overleveraged_shorts";
  } else if (
    previous24h &&
    Math.sign(priceChange24hPct) !== Math.sign(fundingChange24hPct) &&
    Math.abs(priceChange24hPct) >= 1.5 &&
    Math.abs(fundingChange24hPct) >= 0.01
  ) {
    divergence = "diverging";
  }

  const zones = [];
  let activeZone = null;

  for (let index = 1; index < mergedSeries.length; index += 1) {
    const current = mergedSeries[index];
    const previous = mergedSeries[index - 1];
    const priceDeltaPct = pctChange(previous.price, current.price);
    const fundingDeltaPct = (current.rate - previous.rate) * 100;
    const isDiverging =
      Math.sign(priceDeltaPct) !== Math.sign(fundingDeltaPct) &&
      Math.abs(priceDeltaPct) >= 1 &&
      Math.abs(fundingDeltaPct) >= 0.008;

    if (isDiverging && !activeZone) {
      activeZone = {
        start: previous.label,
        end: current.label,
      };
    } else if (isDiverging && activeZone) {
      activeZone.end = current.label;
    } else if (!isDiverging && activeZone) {
      zones.push(activeZone);
      activeZone = null;
    }
  }

  if (activeZone) {
    zones.push(activeZone);
  }

  return {
    divergence,
    divergenceSignal,
    priceChange24hPct,
    priceChange72hPct,
    fundingChange24hPct,
    divergenceZones: zones,
  };
}

function closestHistoricalComparisons(currentRate, historicalRates, prices) {
  const orderedRates = [...historicalRates].sort((a, b) => a.timestamp - b.timestamp);
  const orderedPrices = [...prices].sort((a, b) => a.timestamp - b.timestamp);
  const priceIndex = new Map(
    orderedPrices.map((point, index) => [point.timestamp, { point, index }])
  );

  return orderedRates
    .slice(0, -3)
    .map((point) => {
      const priceMeta = priceIndex.get(point.timestamp);
      if (!priceMeta) return null;

      const after24h = orderedPrices[priceMeta.index + 1];
      const after48h = orderedPrices[priceMeta.index + 2];
      const after72h = orderedPrices[priceMeta.index + 3];

      if (!after24h || !after48h || !after72h) return null;

      return {
        date: toLabel(point.timestamp),
        timestamp: point.timestamp,
        rate: point.rate,
        ratePct: point.rate * 100,
        distance: Math.abs(point.rate - currentRate),
        after24hPct: pctChange(priceMeta.point.price, after24h.price),
        after48hPct: pctChange(priceMeta.point.price, after48h.price),
        after72hPct: pctChange(priceMeta.point.price, after72h.price),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);
}

export function analyzeFunding(
  currentRate,
  historicalRates,
  btcRate,
  ethRate,
  prices,
  marketContext = {}
) {
  const orderedRates = [...historicalRates].sort((a, b) => a.timestamp - b.timestamp);
  const orderedPrices = [...prices].sort((a, b) => a.timestamp - b.timestamp);
  const rateValues = orderedRates.map((point) => point.rate);
  const last7Rates = orderedRates.slice(-7).map((point) => point.rate);
  const mergedSeries = buildMergedSeries(orderedPrices, orderedRates);
  const percentile =
    rateValues.filter((value) => value <= currentRate).length / Math.max(rateValues.length, 1);
  const sortedRateValues = [...rateValues].sort((a, b) => a - b);
  const percentileThreshold = quantile(sortedRateValues, 0.8);
  const avgLast7Days = average(last7Rates);
  const trend = deriveTrend(orderedRates);
  const divergenceState = detectDivergence(mergedSeries);
  const priceStructure = derivePriceStructure(orderedPrices);
  const historicalComparisons = closestHistoricalComparisons(
    currentRate,
    orderedRates,
    orderedPrices
  );
  const liquidityContext = deriveLiquidityContext(
    marketContext.volume24h ?? 0,
    marketContext.openInterest ?? 0
  );

  let crossAssetSignal = "neutral";
  if (btcRate - ethRate > 0.00012) {
    crossAssetSignal = "btc_more_crowded";
  } else if (ethRate - btcRate > 0.00012) {
    crossAssetSignal = "eth_more_crowded";
  }

  const structureScore = deriveMarketStructureScore({
    currentRate,
    percentile,
    divergenceSignal: divergenceState.divergenceSignal,
    priceStructure,
    liquidityContext,
  });

  return {
    percentile: Math.round(percentile * 100),
    avgLast7Days,
    trend,
    divergence: divergenceState.divergence,
    divergenceSignal: divergenceState.divergenceSignal,
    crossAssetSignal,
    historicalComparisons,
    currentRatePct: currentRate * 100,
    avgLast7DaysPct: avgLast7Days * 100,
    percentileThreshold,
    percentileThresholdPct: percentileThreshold * 100,
    priceChange24hPct: divergenceState.priceChange24hPct,
    priceChange72hPct: divergenceState.priceChange72hPct,
    fundingChange24hPct: divergenceState.fundingChange24hPct,
    divergenceZones: divergenceState.divergenceZones,
    crossAssetSpreadPct: (btcRate - ethRate) * 100,
    momentum1dPct: priceStructure.momentum1dPct,
    momentum7dPct: priceStructure.momentum7dPct,
    momentum30dPct: priceStructure.momentum30dPct,
    distanceFromMa7Pct: priceStructure.distanceFromMa7Pct,
    distanceFromMa30Pct: priceStructure.distanceFromMa30Pct,
    realizedVolatility7dPct: priceStructure.realizedVolatility7dPct,
    realizedVolatility30dPct: priceStructure.realizedVolatility30dPct,
    volatilityRegime: priceStructure.volatilityRegime,
    priceTrend: priceStructure.priceTrend,
    marketRegime: priceStructure.marketRegime,
    priceRangePositionPct: priceStructure.priceRangePositionPct,
    monthHigh: priceStructure.monthHigh,
    monthLow: priceStructure.monthLow,
    ma7: priceStructure.ma7,
    ma30: priceStructure.ma30,
    volumeToOiRatio: liquidityContext.volumeToOiRatio,
    oiToVolumeRatio: liquidityContext.oiToVolumeRatio,
    liquidityRegime: liquidityContext.liquidityRegime,
    crowdingRegime: liquidityContext.crowdingRegime,
    marketStructureScore: structureScore.marketStructureScore,
    marketBias: structureScore.marketBias,
    windowDays: Math.round(
      (orderedRates.at(-1)?.timestamp - orderedRates[0]?.timestamp || DAY_MS) / DAY_MS
    ),
  };
}

export default analyzeFunding;
