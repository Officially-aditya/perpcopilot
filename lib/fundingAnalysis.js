const DAY_MS = 24 * 60 * 60 * 1000;

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  prices
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
  const historicalComparisons = closestHistoricalComparisons(
    currentRate,
    orderedRates,
    orderedPrices
  );

  let crossAssetSignal = "neutral";
  if (btcRate - ethRate > 0.00012) {
    crossAssetSignal = "btc_more_crowded";
  } else if (ethRate - btcRate > 0.00012) {
    crossAssetSignal = "eth_more_crowded";
  }

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
    windowDays: Math.round(
      (orderedRates.at(-1)?.timestamp - orderedRates[0]?.timestamp || DAY_MS) / DAY_MS
    ),
  };
}

export default analyzeFunding;
