# PerpCopilot

PerpCopilot is an AI trading copilot for Pacifica perpetual futures traders. It combines Pacifica market data, funding-rate analytics, recent news, and Claude-powered reasoning into a single Next.js 14 app that explains what current perp market structure means for a specific trade.

## Stack

- Framework: Next.js 14 App Router
- UI: React, Tailwind CSS, Recharts
- APIs: Pacifica REST API, Brave Search API, Anthropic Claude API

## Setup

Install everything from the root only:

```bash
npm install
```

Copy the local env template:

```bash
cp .env.local.example .env.local
```

Fill in:

```env
ANTHROPIC_API_KEY=
BRAVE_API_KEY=
PACIFICA_API_BASE=https://api.pacifica.fi/api/v1
```

Run the app:

```bash
npm run dev
```

The full app runs on:

- `http://localhost:3000`

## API Keys

Anthropic:
- Create an API key from the Anthropic Console
- Paste it into `ANTHROPIC_API_KEY`

Brave Search:
- Create a Brave Search API subscription
- Paste the key into `BRAVE_API_KEY`

Pacifica:
- Public market endpoints do not require a private trading key for this app
- `PACIFICA_API_BASE` defaults to mainnet `https://api.pacifica.fi/api/v1`
- The app accepts either `https://api.pacifica.fi` or `https://api.pacifica.fi/api/v1` and normalizes both safely

## Demo Mode

The app is designed to remain demoable even if external services fail.

- Pacifica unavailable: realistic mock BTC and ETH funding and price histories are used automatically
- Brave unavailable: the app skips headlines and continues the analysis flow
- Claude unavailable: the query route falls back to a deterministic recommendation generator with the same JSON shape

When Pacifica falls back, the UI shows a demo-mode banner.

## Project Structure

```text
perp-copilot/
├── app/
│   ├── api/
│   │   ├── market/route.js
│   │   ├── news/route.js
│   │   └── query/route.js
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── components/
│   ├── CrossAssetChart.jsx
│   ├── FundingRateChart.jsx
│   ├── LoadingSequence.jsx
│   ├── MarketContext.jsx
│   ├── MetricsBar.jsx
│   ├── PriceFundingDivergenceChart.jsx
│   ├── QueryInput.jsx
│   ├── RecommendationCard.jsx
│   └── RiskFactors.jsx
├── lib/
│   ├── fundingAnalysis.js
│   ├── marketData.js
│   ├── news.js
│   └── recommendation.js
├── .env.local.example
├── next.config.js
├── package.json
└── README.md
```

## Pacifica Endpoints Used

- `GET /api/v1/info/prices`
- `GET /api/v1/funding_rate/history`
- `GET /api/v1/kline/mark`

## DoraHacks Submission Blurb

PerpCopilot turns Pacifica into an explainable trading workstation instead of a raw data feed. Traders can ask natural-language questions about BTC or ETH perpetuals, then get live or demo-safe Pacifica market structure, quantitative funding analysis, relevant news, and a structured AI recommendation backed by interactive charts that show why the setup matters.

## Hackathon Submission Assets

- DoraHacks copy: [docs/dorahacks-submission.md](./docs/dorahacks-submission.md)
- Demo script: [docs/demo-script.md](./docs/demo-script.md)

## Judge Notes

- The app is designed to be demo-safe. If Pacifica, Brave, or Anthropic are unavailable during a presentation, the product still completes an end-to-end walkthrough instead of failing on stage.
- The results screen includes a dedicated Pacifica integration section so judges can immediately see which endpoints power which insights.
