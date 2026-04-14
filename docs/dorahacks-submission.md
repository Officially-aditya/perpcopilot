# PerpCopilot DoraHacks Submission Copy

## One-line Pitch

PerpCopilot is an AI trading copilot for Pacifica perpetuals that explains what funding, price action, and positioning actually mean for a specific trade.

## Short Description

PerpCopilot helps perpetual futures traders turn Pacifica market data into actionable context. A user asks a natural-language question like "Should I long BTC right now?" and the app combines Pacifica live market data, 30-day funding history, mark-price divergence analysis, cross-asset positioning, and recent news to return a structured trade recommendation with interactive charts and plain-English reasoning.

## Problem

Perp traders can see funding rates, price moves, volume, and open interest, but those signals are hard to interpret quickly under pressure. Raw dashboards tell you what the market is doing, but not what it means for crowding, carry cost, reversal risk, or whether the setup is actually attractive.

## Solution

PerpCopilot acts like an explainable trading copilot on top of Pacifica. It:

- pulls Pacifica mark price, funding, volume, and open interest
- analyzes the current funding reading versus the last 30 days
- detects price versus funding divergence
- compares BTC and ETH crowding
- adds recent external news context
- produces a structured recommendation with charts that visually support the call

## Pacifica Integration

Core Pacifica endpoints used:

- `GET /api/v1/info/prices`
- `GET /api/v1/funding_rate/history`
- `GET /api/v1/kline/mark`

Pacifica is not an optional add-on in the product. The recommendation and charts are built from Pacifica market structure before AI reasoning is applied.

## Track Fit

Primary track:
- Analytics & Data

Strong secondary angle:
- Best User Experience

## Impact

PerpCopilot gives traders a faster way to understand whether positioning is stretched, whether funding is expensive, and whether a move is supported or overcrowded. Instead of a generic dashboard or generic LLM answer, it provides Pacifica-native context with visual evidence.
