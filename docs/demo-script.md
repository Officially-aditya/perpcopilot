# PerpCopilot Demo Script

Target length: 5 to 7 minutes

## 1. Problem and Hook

"Perp traders are flooded with raw data like funding, open interest, and price action, but in the moment it is still hard to answer a simple question: does this setup actually look attractive or dangerously crowded? PerpCopilot turns Pacifica market structure into an explainable trade read."

## 2. Product Overview

"We built PerpCopilot, an AI trading copilot for Pacifica perpetuals. A trader can ask a natural-language question like 'Should I long BTC right now?' and the app pulls Pacifica market data, runs quantitative funding analysis, adds external news context, and returns a structured recommendation with charts that show why."

## 3. Live Walkthrough

Use BTC first:

- Show the landing screen
- Enter: `Should I long BTC right now?`
- Select BTC
- Submit
- Briefly mention the loading sequence: Pacifica data, analysis, news, AI reasoning

On results:

- Start with the recommendation pill and confidence
- Call out the metrics bar: price, funding, 24h volume, open interest
- Open the funding chart and explain percentile plus historical comparison markers
- Show the divergence chart and explain what overleveraged longs or shorts means
- Show the cross-asset chart and explain BTC vs ETH crowding
- End on the risk factors and suggested setup

## 4. Pacifica Integration

"Pacifica is the core data layer here. We use `GET /info/prices` for live mark price, funding, volume, and open interest, `GET /funding_rate/history` for the historical funding curve and percentile analysis, and `GET /kline/mark` for the mark-price series used in divergence detection."

If fallback data is active:

"Even when live APIs are unavailable, the app remains fully demoable using realistic Pacifica-shaped fallback data so judges can still evaluate the product experience end to end."

## 5. Why It Matters

"This is useful because traders do not just need data, they need interpretation. PerpCopilot makes crowding, carry cost, and reversal risk understandable fast enough to matter during live decision-making."

## 6. What’s Next

"With more time, we would add account-aware position context, Pacifica testnet execution flows, alerts for extreme funding regimes, and saved trade journals so traders can compare outcomes against prior analog setups."
