import "server-only";

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 1000;

function resolveApiBase() {
  const rawBase = (process.env.PACIFICA_API_BASE || "https://api.pacifica.fi").replace(/\/$/, "");
  return rawBase.endsWith("/api/v1") ? rawBase : `${rawBase}/api/v1`;
}

const API_BASE = resolveApiBase();

let cachedSnapshot = null;
let cachedAt = 0;

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function compactNumber(value) {
  return Number(value.toFixed(2));
}

function formatLabel(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildDemoAsset(asset) {
  const now = Date.now();
  const basePrice = asset === "BTC" ? 90250 : 3185;
  const trendPerDay = asset === "BTC" ? 105 : 12;
  const volatility = asset === "BTC" ? 1450 : 125;
  const rateBase = asset === "BTC" ? 0.00026 : 0.00034;
  const phase = asset === "BTC" ? 0.35 : 0.92;

  const fundingHistory = [];
  const priceHistory = [];

  for (let index = 0; index < 30; index += 1) {
    const timestamp = now - (29 - index) * DAY_MS;
    const wave = Math.sin(index * 0.42 + phase);
    const secondary = Math.cos(index * 0.23 + phase * 1.7);
    const spike = index > 24 ? (index - 24) * 0.00008 : 0;
    const rate = clamp(
      rateBase + wave * 0.00019 + secondary * 0.00011 + spike,
      -0.0001,
      0.0012
    );
    const price =
      basePrice +
      index * trendPerDay +
      wave * volatility +
      secondary * volatility * 0.4 +
      (index > 26 ? (index - 26) * (asset === "BTC" ? 420 : 48) : 0);

    fundingHistory.push({
      timestamp,
      label: formatLabel(timestamp),
      rate: round(rate, 6),
      ratePct: round(rate * 100, 4),
    });
    priceHistory.push({
      timestamp,
      label: formatLabel(timestamp),
      price: compactNumber(price),
    });
  }

  return {
    asset,
    currentPrice: priceHistory.at(-1).price,
    currentFundingRate: fundingHistory.at(-1).rate,
    volume24h: asset === "BTC" ? 1825000000 : 934000000,
    openInterest: asset === "BTC" ? 1240000000 : 645000000,
    fundingHistory,
    priceHistory,
  };
}

function buildDemoSnapshot() {
  return {
    meta: {
      demoMode: true,
      source: "demo",
      updatedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL_MS,
    },
    assets: {
      BTC: buildDemoAsset("BTC"),
      ETH: buildDemoAsset("ETH"),
    },
  };
}

async function fetchJson(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pacifica request failed: ${response.status}`);
  }

  return response.json();
}

function unwrapData(payload) {
  return payload?.data ?? payload;
}

function extractArray(payload, candidateKeys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of candidateKeys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function extractMarketRow(payload, symbol) {
  const data = unwrapData(payload);
  if (data?.[symbol]) return data[symbol];
  if (data?.markets?.[symbol]) return data.markets[symbol];
  if (data?.prices?.[symbol]) return data.prices[symbol];
  const rows = extractArray(data, ["markets", "prices", "items", "rows"]);
  return rows.find((row) => row?.symbol === symbol || row?.asset === symbol) || null;
}

function pickField(record, aliases) {
  for (const alias of aliases) {
    if (record?.[alias] !== undefined && record?.[alias] !== null) {
      const numeric = Number(record[alias]);
      return Number.isFinite(numeric) ? numeric : record[alias];
    }
  }
  return null;
}

function normalizeFundingHistory(payload) {
  const rows = extractArray(unwrapData(payload), ["history", "items", "rows"]);
  return rows
    .map((row, index) => {
      const timestamp = Number(
        row?.timestamp ??
          row?.created_at ??
          row?.time ??
          Date.now() - (rows.length - index - 1) * DAY_MS
      );
      const rate = Number(
        row?.funding_rate ??
          row?.funding ??
          row?.rate ??
          row?.current_funding_rate ??
          row?.next_funding_rate ??
          row?.next_funding
      );

      if (!Number.isFinite(timestamp) || !Number.isFinite(rate)) return null;
      return {
        timestamp,
        label: formatLabel(timestamp),
        rate: round(rate, 6),
        ratePct: round(rate * 100, 4),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function normalizePriceHistory(payload) {
  const rows = extractArray(unwrapData(payload), ["candles", "items", "rows"]);

  return rows
    .map((row, index) => {
      const isArrayRow = Array.isArray(row);
      const timestamp = Number(
        isArrayRow
          ? row[0]
          : row?.timestamp ??
              row?.open_time ??
              row?.created_at ??
              Date.now() - (rows.length - index - 1) * DAY_MS
      );
      const close = Number(
        isArrayRow
          ? row[4]
          : row?.close ??
              row?.c ??
              row?.close_price ??
              row?.price ??
              row?.mark_price ??
              row?.mark
      );

      if (!Number.isFinite(timestamp) || !Number.isFinite(close)) return null;
      return {
        timestamp,
        label: formatLabel(timestamp),
        price: compactNumber(close),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function alignDailySeries(fundingHistory, priceHistory) {
  const length = Math.min(fundingHistory.length, priceHistory.length);
  return {
    fundingHistory: fundingHistory.slice(-length),
    priceHistory: priceHistory.slice(-length),
  };
}

async function fetchLiveAsset(symbol, pricePayload) {
  const row = extractMarketRow(pricePayload, symbol);
  const currentPrice =
    pickField(row, [
      "mark",
      "mark_price",
      "price",
      "last_price",
      "mid",
      "mid_price",
      "oracle",
      "oracle_price",
    ]) ?? null;
  const currentFundingRate =
    pickField(row, [
      "funding",
      "funding_rate",
      "current_funding_rate",
      "next_funding",
      "next_funding_rate",
    ]) ?? null;
  const volume24h = pickField(row, ["volume_24h", "day_volume", "volume24h", "volume"]) ?? null;
  const openInterest = pickField(row, ["open_interest", "oi", "openInterest"]) ?? null;

  const [fundingPayload, priceHistoryPayload] = await Promise.all([
    fetchJson("/funding_rate/history", {
      symbol,
      limit: 30,
    }),
    fetchJson("/kline/mark", {
      symbol,
      interval: "1d",
      start_time: Date.now() - 29 * DAY_MS,
      end_time: Date.now(),
    }),
  ]);

  const normalizedFunding = normalizeFundingHistory(fundingPayload);
  const normalizedPrices = normalizePriceHistory(priceHistoryPayload);
  const { fundingHistory, priceHistory } = alignDailySeries(
    normalizedFunding,
    normalizedPrices
  );

  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(currentFundingRate) ||
    fundingHistory.length < 14 ||
    priceHistory.length < 14
  ) {
    throw new Error(`Incomplete live market data for ${symbol}`);
  }

  return {
    asset: symbol,
    currentPrice: compactNumber(currentPrice),
    currentFundingRate: round(currentFundingRate, 6),
    volume24h: Number.isFinite(volume24h) ? compactNumber(volume24h) : 0,
    openInterest: Number.isFinite(openInterest) ? compactNumber(openInterest) : 0,
    fundingHistory,
    priceHistory,
  };
}

async function fetchLiveSnapshot() {
  const pricePayload = await fetchJson("/info/prices");
  const [btc, eth] = await Promise.all([
    fetchLiveAsset("BTC", pricePayload),
    fetchLiveAsset("ETH", pricePayload),
  ]);

  return {
    meta: {
      demoMode: false,
      source: "live",
      updatedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL_MS,
    },
    assets: {
      BTC: btc,
      ETH: eth,
    },
  };
}

export async function getMarketSnapshot({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedSnapshot && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  try {
    const snapshot = await fetchLiveSnapshot();
    cachedSnapshot = snapshot;
    cachedAt = Date.now();
    return snapshot;
  } catch (error) {
    console.warn("Falling back to demo market data", error.message);
    const demoSnapshot = buildDemoSnapshot();
    cachedSnapshot = demoSnapshot;
    cachedAt = Date.now();
    return demoSnapshot;
  }
}
