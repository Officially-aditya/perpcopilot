"use client";

import { startTransition, useEffect, useState } from "react";
import CrossAssetChart from "../components/CrossAssetChart.jsx";
import FundingRateChart from "../components/FundingRateChart.jsx";
import LoadingSequence from "../components/LoadingSequence.jsx";
import MarketContext from "../components/MarketContext.jsx";
import MetricsBar from "../components/MetricsBar.jsx";
import PriceFundingDivergenceChart from "../components/PriceFundingDivergenceChart.jsx";
import QueryInput from "../components/QueryInput";
import RecommendationCard from "../components/RecommendationCard.jsx";
import RiskFactors from "../components/RiskFactors.jsx";

type HistoricalComparison = {
  timestamp: number;
  date: string;
  after24hPct: number;
  after48hPct: number;
  after72hPct: number;
};

type Analysis = {
  percentile: number;
  historicalComparisons: HistoricalComparison[];
  marketBias: string;
  marketStructureScore: number;
};

type Recommendation = {
  recommendation: string;
  confidence: string;
  suggested_entry: string | null;
  suggested_stop_loss: string | null;
  time_horizon: string;
  funding_rate_insight: string;
  summary: string;
  chart_annotation: string;
  divergence_insight: string;
  cross_asset_insight: string;
  market_context: string;
  risk_factors: string[];
};

type Explainer = {
  title: string;
  summary: string;
  key_points: string[];
  market_hook: string | null;
  follow_ups: string[];
};

type ResultData = {
  query: string;
  queryMode: "market_analysis" | "explainer";
  queryIntent: "trade_entry" | "position_management";
  asset: string;
  market: {
    currentPrice: number;
    currentFundingRate: number;
  };
  analysis: Analysis;
  recommendation: Recommendation | null;
  explainer: Explainer | null;
  comparison: unknown;
  news: unknown[];
  meta: {
    demoMode: boolean;
    aiSource: string;
    aiModel: string;
    aiError: string | null;
    availableAssets?: string[];
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function HistoricalComparisonTable({ analysis }: { analysis: Analysis }) {
  if (!analysis.historicalComparisons.length) {
    return (
      <div className="py-6 text-sm uppercase tracking-[0.16em] text-[rgba(255,255,255,0.34)]">
        No close historical funding analogs were found in the current 30-day sample.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left">
        <thead>
          <tr className="text-xs uppercase tracking-[0.22em] text-[#00e3fd]">
            <th className="py-3 pr-8 font-mono">When rate was here</th>
            <th className="py-3 pr-8 font-mono">24h after</th>
            <th className="py-3 pr-8 font-mono">48h after</th>
            <th className="py-3 font-mono">72h after</th>
          </tr>
        </thead>
        <tbody>
          {analysis.historicalComparisons.map((item) => (
            <tr
              key={item.timestamp}
              className="text-sm text-textPrimary"
            >
              <td className="py-4 pr-8 font-mono text-[#ffffff]">{item.date}</td>
              <td className="py-4 pr-8">{formatSigned(item.after24hPct)}</td>
              <td className="py-4 pr-8">{formatSigned(item.after48hPct)}</td>
              <td className="py-4">{formatSigned(item.after72hPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundingInsightCard({ result }: { result: ResultData }) {
  const percentileOrdinal = `${result.analysis.percentile}th`;

  return (
    <section className="console-section p-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="console-kicker mb-2">Funding Insight</p>
          <h3 className="console-headline text-textPrimary">How Expensive The Current Carry Regime Is</h3>
        </div>
        <div className="text-right">
          <p className="console-kicker mb-1">Current Percentile</p>
          <p className="console-monodata text-2xl text-[#9cff93]">{percentileOrdinal}</p>
        </div>
      </div>

      <p className="console-hanging mb-10 text-base leading-8 text-[rgba(255,255,255,0.8)]">
        {result.recommendation.funding_rate_insight}
      </p>

      <HistoricalComparisonTable analysis={result.analysis} />
    </section>
  );
}

function TradeSetupCard({
  recommendation,
  queryIntent,
}: {
  recommendation: Recommendation;
  queryIntent: "trade_entry" | "position_management";
}) {
  const isPositionManagement = queryIntent === "position_management";
  const primaryLabel = isPositionManagement ? "Action Zone" : "Suggested Entry";
  const stopLabel = isPositionManagement ? "Invalidation Level" : "Stop Loss";
  const title = isPositionManagement ? "Position Plan" : "Execution Framing";
  const primaryValue =
    recommendation.suggested_entry ||
    (isPositionManagement ? "Maintain current size unless conditions change" : "Stand aside");

  return (
    <section className="console-section h-full p-8">
      <p className="console-kicker mb-2">Trade Setup</p>
      <h3 className="console-headline mb-10 text-textPrimary">{title}</h3>

      <div className="console-subvoid">
        <div>
          <p className="console-kicker mb-2">{primaryLabel}</p>
          <p className="text-lg text-textPrimary">
            {primaryValue}
          </p>
        </div>
        <div>
          <p className="console-kicker mb-2">{stopLabel}</p>
          <p className="text-lg text-textPrimary">
            {recommendation.suggested_stop_loss || "N/A"}
          </p>
        </div>
        <div>
          <p className="console-kicker mb-2">Time Horizon</p>
          <p className="text-base leading-7 text-[rgba(240,240,240,0.8)]">
            {recommendation.time_horizon}
          </p>
        </div>
        <p className="console-kicker text-[#777575]">AI-generated analysis. Not financial advice.</p>
      </div>
    </section>
  );
}

function ExplainerHero({ explainer }: { explainer: Explainer }) {
  return (
    <section className="detail-section md:grid md:grid-cols-[240px_1fr] md:gap-10">
      <div className="mb-6 md:mb-0">
        <div className="detail-mono inline-flex min-w-[200px] items-center justify-center border border-[rgba(0,227,253,0.25)] bg-[rgba(0,227,253,0.08)] px-8 py-5 text-xl font-semibold uppercase tracking-[0.16em] text-[#7defff]">
          Explain
        </div>
      </div>
      <div>
        <div className="mb-4">
          <span className="detail-title text-[rgba(255,255,255,0.38)]">{explainer.title}</span>
        </div>
        <p className="max-w-4xl text-[1.05rem] leading-10 text-[rgba(255,255,255,0.72)]">
          {explainer.summary}
        </p>
      </div>
    </section>
  );
}

function ExplainerDetails({
  explainer,
  marketContext,
  news,
  demoMode,
}: {
  explainer: Explainer;
  marketContext: string;
  news: unknown[];
  demoMode: boolean;
}) {
  return (
    <>
      <div className="detail-divider grid lg:grid-cols-[1fr_1fr]">
        <section className="console-section p-8 detail-grid-divider">
          <p className="console-kicker mb-2">Key Points</p>
          <div className="console-subvoid">
            {explainer.key_points.map((point) => (
              <p key={point} className="text-base leading-8 text-[rgba(255,255,255,0.8)]">
                {point}
              </p>
            ))}
          </div>
        </section>
        <section className="console-section p-8">
          <p className="console-kicker mb-2">Market Hook</p>
          <h3 className="console-headline mb-8 text-textPrimary">Why It Matters Now</h3>
          <p className="text-base leading-8 text-[rgba(255,255,255,0.8)]">
            {explainer.market_hook || "This answer was primarily conceptual, so live market context is secondary."}
          </p>
        </section>
      </div>

      <div className="detail-divider grid lg:grid-cols-[1fr_1fr]">
        <section className="console-section p-8 detail-grid-divider">
          <p className="console-kicker mb-2">Suggested Follow-Ups</p>
          <div className="console-subvoid">
            {explainer.follow_ups.map((item) => (
              <p key={item} className="text-base leading-8 text-[rgba(255,255,255,0.8)]">
                {item}
              </p>
            ))}
          </div>
        </section>
        <MarketContext
          context={marketContext}
          news={news}
          demoMode={demoMode}
        />
      </div>
    </>
  );
}

function ModelStatus({
  aiSource,
  aiModel,
  aiError,
}: {
  aiSource: string;
  aiModel: string;
  aiError: string | null;
}) {
  const isLiveModel = aiSource === "oxlo";

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em]">
      <span
        className={
          isLiveModel
            ? "detail-mono text-[#9cff93]"
            : "detail-mono text-[#ff7351]"
        }
      >
        LLM {isLiveModel ? "Oxlo Live" : "Heuristic Fallback"}
      </span>
      <span className="detail-mono text-[rgba(255,255,255,0.38)]">{aiModel}</span>
      {aiError ? (
        <span className="detail-mono text-[rgba(255,255,255,0.32)]">
          {aiError}
        </span>
      ) : null}
    </div>
  );
}

function ErrorCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="console-shell">
      <div className="console-main flex min-h-screen max-w-4xl items-center justify-center">
        <div className="console-section w-full p-10">
          <p className="console-kicker mb-3 text-[#ff7351]">Run Failed</p>
          <h2 className="console-display mb-6 text-left text-[#ff7351]">Analysis Error</h2>
          <p className="console-hanging mb-10 max-w-2xl text-base leading-8 text-[rgba(255,255,255,0.8)]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="console-button-primary px-5 py-3 text-sm transition hover:opacity-90"
        >
          Try Again
        </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [asset, setAsset] = useState("BTC");
  const [availableAssets, setAvailableAssets] = useState<string[]>(["BTC", "ETH"]);
  const [query, setQuery] = useState("Should I long BTC right now?");
  const [view, setView] = useState("input");
  const [loadingStage, setLoadingStage] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (view !== "loading") return undefined;

    setLoadingStage(0);
    const interval = window.setInterval(() => {
      setLoadingStage((current) => Math.min(current + 1, 3));
    }, 700);

    return () => window.clearInterval(interval);
  }, [view]);

  useEffect(() => {
    let isMounted = true;

    async function loadAssets() {
      try {
        const response = await fetch("/api/market");
        const json = await response.json();
        if (!response.ok || !json.success) return;

        const nextAssets = json?.data?.meta?.availableAssets || json?.meta?.availableAssets;
        if (isMounted && Array.isArray(nextAssets) && nextAssets.length) {
          setAvailableAssets(nextAssets);
          setAsset((current) => (nextAssets.includes(current) ? current : nextAssets[0]));
        }
      } catch (_error) {
        // Keep fallback assets if market bootstrap fails.
      }
    }

    loadAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(nextQuery: string) {
    const payload = {
      query: nextQuery,
      asset,
    };

    setError("");
    setView("loading");

    try {
      const responsePromise = fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const minimumDelay = new Promise((resolve) => {
        window.setTimeout(resolve, 2400);
      });

      const [response] = await Promise.all([responsePromise, minimumDelay]);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to generate analysis.");
      }

      startTransition(() => {
        setResult(json.data);
        setView("result");
      });
    } catch (requestError) {
      const nextError =
        requestError instanceof Error ? requestError.message : "Something went wrong.";
      setError(nextError);
      setView("error");
    }
  }

  if (view === "loading") {
    return <LoadingSequence activeStep={loadingStage} />;
  }

  if (view === "error") {
    return (
      <ErrorCard
        error={error}
        onRetry={() => {
          setView("input");
        }}
      />
    );
  }

  if (view !== "result" || !result) {
    return (
      <QueryInput
        query={query}
        asset={asset}
        assets={availableAssets}
        isLoading={false}
        onQueryChange={setQuery}
        onAssetChange={setAsset}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="console-shell">
      <div className="kinetic-wireframe pointer-events-none absolute inset-0 z-0 opacity-15" />
      <div className="kinetic-scanline pointer-events-none absolute inset-0 z-0 opacity-20" />
      <div className="console-main !max-w-[1260px]">
        <div className="mb-8 flex items-center justify-between gap-6">
          <div>
            <p className="detail-title mb-2">PerpCopilot</p>
            <p className="detail-mono text-sm uppercase tracking-[0.16em] text-[rgba(255,255,255,0.26)]">
              Detail View
            </p>
            <div className="mt-3">
              <ModelStatus
                aiSource={result.meta.aiSource}
                aiModel={result.meta.aiModel}
                aiError={result.meta.aiError}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setView("input");
              setResult(null);
            }}
            className="detail-mono text-sm uppercase tracking-[0.18em] text-[rgba(255,255,255,0.4)] transition hover:text-white"
          >
            Ask another question
          </button>
        </div>

        <div className="detail-shell">
          <MetricsBar asset={result.asset} market={result.market} analysis={result.analysis} />

          {result.queryMode === "market_analysis" && result.recommendation ? (
            <>
              <div className="detail-divider">
                <RecommendationCard recommendation={result.recommendation} />
              </div>

              <div className="detail-divider grid lg:grid-cols-[1fr_1fr]">
                <div className="detail-grid-divider">
                  <FundingRateChart
                    market={result.market}
                    analysis={result.analysis}
                    annotation={result.recommendation.chart_annotation}
                  />
                </div>
                <FundingInsightCard result={result as ResultData} />
              </div>

              <div className="detail-divider grid lg:grid-cols-[1fr_1fr]">
                <div className="detail-grid-divider">
                  <PriceFundingDivergenceChart
                    market={result.market}
                    analysis={result.analysis}
                    insight={result.recommendation.divergence_insight}
                  />
                </div>
                <RiskFactors items={result.recommendation.risk_factors} />
              </div>

              <div className="detail-divider">
                <CrossAssetChart
                  asset={result.asset}
                  comparison={result.comparison}
                  insight={result.recommendation.cross_asset_insight}
                />
              </div>

              <div className="detail-divider">
                <MarketContext
                  context={result.recommendation.market_context}
                  news={result.news}
                  demoMode={result.meta.demoMode}
                />
              </div>

              <div className="detail-divider">
                <TradeSetupCard
                  recommendation={result.recommendation}
                  queryIntent={result.queryIntent}
                />
              </div>
            </>
          ) : result.explainer ? (
            <>
              <div className="detail-divider">
                <ExplainerHero explainer={result.explainer} />
              </div>
              <ExplainerDetails
                explainer={result.explainer}
                marketContext={result.explainer.market_hook || "The current Pacifica market snapshot is shown above for reference."}
                news={result.news}
                demoMode={result.meta.demoMode}
              />
            </>
          ) : null}
        </div>

        {result.meta.demoMode ? (
          <div className="mx-auto mt-4 max-w-[1180px] text-sm text-[#ff7351]">
            Live Pacifica data was unavailable, so the analysis is currently using resilient fallback market data.
          </div>
        ) : null}
      </div>
    </div>
  );
}
