import "server-only";

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 1000;
const MAX_TRACKED_ASSETS = 6;
const PRIORITY_SYMBOLS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "BONK", "kBONK"];

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
  if (Math.abs(value) >= 1000) return Number(value.toFixed(2));
  if (Math.abs(value) >= 1) return Number(value.toFixed(4));
  if (Math.abs(value) >= 0.01) return Number(value.toFixed(6));
  return Number(value.toFixed(10));
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
  const presets = {
    BTC: { basePrice: 90250, trendPerDay: 105, volatility: 1450, rateBase: 0.00026, phase: 0.35, volume24h: 1825000000, openInterest: 1240000000 },
    ETH: { basePrice: 3185, trendPerDay: 12, volatility: 125, rateBase: 0.00034, phase: 0.92, volume24h: 934000000, openInterest: 645000000 },
    SOL: { basePrice: 184, trendPerDay: 1.4, volatility: 13, rateBase: 0.00041, phase: 1.12, volume24h: 522000000, openInterest: 302000000 },
    XRP: { basePrice: 0.68, trendPerDay: 0.004, volatility: 0.05, rateBase: 0.00029, phase: 1.56, volume24h: 341000000, openInterest: 191000000 },
    DOGE: { basePrice: 0.19, trendPerDay: 0.002, volatility: 0.018, rateBase: 0.00048, phase: 1.88, volume24h: 288000000, openInterest: 165000000 },
    BONK: { basePrice: 0.000028, trendPerDay: 0.0000002, volatility: 0.0000038, rateBase: 0.00055, phase: 2.24, volume24h: 146000000, openInterest: 92000000 },
    kBONK: { basePrice: 0.000028, trendPerDay: 0.0000002, volatility: 0.0000038, rateBase: 0.00055, phase: 2.24, volume24h: 146000000, openInterest: 92000000 },
  };
  const preset = presets[asset] || presets.BTC;
  const { basePrice, trendPerDay, volatility, rateBase, phase, volume24h, openInterest } = preset;

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
      (index > 26 ? (index - 26) * Math.max(basePrice * 0.0045, volatility * 0.35) : 0);

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
    volume24h,
    openInterest,
    fundingHistory,
    priceHistory,
  };
}

function buildDemoSnapshot() {
  const assets = PRIORITY_SYMBOLS.slice(0, MAX_TRACKED_ASSETS).reduce((accumulator, symbol) => {
    accumulator[symbol] = buildDemoAsset(symbol);
    return accumulator;
  }, {});

  return {
    meta: {
      demoMode: true,
      source: "demo",
      updatedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL_MS,
      availableAssets: Object.keys(assets),
    },
    assets,
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

function listAvailableSymbols(payload) {
  const data = unwrapData(payload);
  const rowArray = extractArray(data, ["markets", "prices", "items", "rows"]);
  const objectEntries = data && typeof data === "object" ? Object.entries(data) : [];
  const candidates = [];

  for (const [symbol, row] of objectEntries) {
    if (typeof symbol !== "string" || !row || typeof row !== "object") continue;
    candidates.push({
      symbol,
      volume24h: pickField(row, ["volume_24h", "day_volume", "volume24h", "volume"]) ?? 0,
      hasFunding: pickField(row, ["funding", "funding_rate", "current_funding_rate", "next_funding", "next_funding_rate"]) !== null,
      hasPrice: pickField(row, ["mark", "mark_price", "price", "last_price", "mid", "mid_price", "oracle", "oracle_price"]) !== null,
    });
  }

  for (const row of rowArray) {
    const symbol = row?.symbol || row?.asset;
    if (typeof symbol !== "string") continue;
    candidates.push({
      symbol,
      volume24h: pickField(row, ["volume_24h", "day_volume", "volume24h", "volume"]) ?? 0,
      hasFunding: pickField(row, ["funding", "funding_rate", "current_funding_rate", "next_funding", "next_funding_rate"]) !== null,
      hasPrice: pickField(row, ["mark", "mark_price", "price", "last_price", "mid", "mid_price", "oracle", "oracle_price"]) !== null,
    });
  }

  const deduped = new Map();
  for (const candidate of candidates) {
    if (!/^[A-Za-z0-9]+$/.test(candidate.symbol)) continue;
    if (!candidate.hasFunding || !candidate.hasPrice) continue;
    const existing = deduped.get(candidate.symbol);
    if (!existing || candidate.volume24h > existing.volume24h) {
      deduped.set(candidate.symbol, candidate);
    }
  }

  const sorted = [...deduped.values()].sort((left, right) => {
    const leftPriority = PRIORITY_SYMBOLS.indexOf(left.symbol);
    const rightPriority = PRIORITY_SYMBOLS.indexOf(right.symbol);
    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) return 1;
      if (rightPriority === -1) return -1;
      return leftPriority - rightPriority;
    }
    return right.volume24h - left.volume24h;
  });

  const prioritized = PRIORITY_SYMBOLS.filter((symbol) => deduped.has(symbol));
  const remaining = sorted.map((item) => item.symbol).filter((symbol) => !prioritized.includes(symbol));
  return [...prioritized, ...remaining].slice(0, MAX_TRACKED_ASSETS);
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
  const symbols = listAvailableSymbols(pricePayload);
  const assets = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const asset = await fetchLiveAsset(symbol, pricePayload);
        assets[symbol] = asset;
      } catch (error) {
        console.warn(`Skipping live asset ${symbol}`, error.message);
      }
    })
  );

  if (!assets.BTC || !assets.ETH) {
    throw new Error("Missing BTC or ETH benchmark data in live snapshot");
  }

  const availableAssets = Object.keys(assets);

  return {
    meta: {
      demoMode: false,
      source: "live",
      updatedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL_MS,
      availableAssets,
    },
    assets,
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
