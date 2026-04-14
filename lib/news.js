import "server-only";

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

function sanitizeAsset(rawAsset) {
  const normalized = String(rawAsset || "").trim();
  return normalized || "BTC";
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return "source";
  }
}

function normalizeNews(payload) {
  const results = payload?.web?.results || [];
  return results.slice(0, 3).map((item) => ({
    title: item?.title || "Untitled result",
    url: item?.url || "#",
    snippet: item?.description || item?.snippet || "",
    source: item?.meta_url?.hostname || safeHostname(item?.url || ""),
  }));
}

export async function getNewsForAsset(asset) {
  const normalizedAsset = sanitizeAsset(asset);
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    return [];
  }

  const url = new URL(BRAVE_API_URL);
  url.searchParams.set("q", `${normalizedAsset} perpetual futures funding rate`);
  url.searchParams.set("count", "3");
  url.searchParams.set("freshness", "pw");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Brave Search request failed: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeNews(payload);
}
