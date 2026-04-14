# Pacifica REST API Reference

Working reference for building against Pacifica's REST API.

Primary docs:
- https://pacifica.gitbook.io/docs/api-documentation/api/rest-api
- Mirror used for a few missing pages: https://docs.pacifica.fi/api-documentation/api/rest-api

Last reviewed from docs: 2026-04-13

## Base URLs

- Mainnet: `https://api.pacifica.fi/api/v1`
- Testnet: `https://test-api.pacifica.fi/api/v1`

Requests and responses are JSON.

## Auth and Signing

General rules:
- `GET` endpoints do not require signing.
- `POST` endpoints require an Ed25519 signature.
- Pacifica signs deterministic JSON.
- Signature values are base58-encoded.
- `timestamp` is in milliseconds.
- `expiry_window` is optional on many signed calls and limits signature validity.
- `agent_wallet` appears on some endpoints when acting via an agent wallet.

High-level signing flow:
1. Build a signing payload with:
   - `type`
   - `timestamp`
   - `expiry_window` if used
   - `data` containing the endpoint request body fields excluding the signature wrapper
2. Recursively sort object keys.
3. Serialize as compact JSON.
4. Sign the UTF-8 bytes with Ed25519.
5. Base58-encode the signature.
6. Include the signature in the request body.

Important:
- Pacifica recommends using their Python SDK for signing and order submission.
- Batch requests are not signed as a whole. Each action inside the batch is signed independently.

### Operation Types

These are the documented signing `type` values:

| Operation type | Endpoint |
| --- | --- |
| `create_order` | `/api/v1/orders/create` |
| `create_stop_order` | `/api/v1/orders/stop/create` |
| `cancel_order` | `/api/v1/orders/cancel` |
| `cancel_all_orders` | `/api/v1/orders/cancel_all` |
| `cancel_stop_order` | `/api/v1/orders/stop/cancel` |
| `update_leverage` | `/api/v1/account/leverage` |
| `update_margin_mode` | `/api/v1/account/margin` |
| `set_position_tpsl` | `/api/v1/positions/tpsl` |
| `withdraw` | `/api/v1/account/withdraw` |
| `subaccount_initiate` | `/api/v1/account/subaccount/create` |
| `subaccount_confirm` | `/api/v1/account/subaccount/create` |
| `create_market_order` | `/api/v1/orders/create_market` |
| `subaccount_transfer` | `/api/v1/account/subaccount/transfer` |
| `bind_agent_wallet` | `/api/v1/agent/bind` |
| `create_api_key` | `/api/v1/account/api_keys/create` |
| `revoke_api_key` | `/api/v1/account/api_keys/revoke` |
| `list_api_keys` | `/api/v1/account/api_keys` |

### Signing Failure Hints

Documented common failures:
- `Invalid signature`
  - malformed base58
  - not a valid Ed25519 signature
  - malformed signature bytes
- `Invalid message`
  - expired message
  - invalid JSON serialization
  - malformed message structure
- `Invalid public key`
  - account is not a valid Ed25519 public key
  - malformed public key bytes
- `Verification failed`
  - wrong private key
  - message mutated after signing
  - signature does not match content

### Hardware Wallet Note

The docs include a separate hardware-wallet signing flow using Solana off-chain message format and a structured signature object with `type: "hardware"`.

## Global API Notes

### Symbols

- Symbols are case-sensitive.
- `BTC` is valid.
- `btc` is invalid.
- Some listings include lowercase-prefixed names like `kBONK`.

### Tick and Lot Size

- Price must respect each market's `tick_size`.
- Amount must respect each market's `lot_size`.
- Limit, stop, and TP/SL order requests can fail if values are not correctly rounded.
- Pacifica explicitly notes that bad rounding can produce errors including `500`.

### Last Order ID

`last_order_id` is a documented exchange-wide sequential nonce used to order events without relying on wall-clock timestamps.

It is returned on:
- `GET /api/v1/positions`
- `GET /api/v1/trades/history`
- `GET /api/v1/orders`

Use it when reconstructing state from API and websocket data.

### Rate Limits

Rolling window:
- 60-second rolling window

Base request units:
- standard request: `1`
- cancel request: `0.5`
- heavier read endpoints can cost more

Documented baseline quotas:
- unidentified IP: `125` credits per 60s
- valid API config key: `300` credits per 60s

Higher documented tiers:
- Regular: `300`
- Silver: `1000`
- Gold: `3000`
- VIP1: `10000`
- VIP2: `25000`
- VIP3: `40000`

Heavy endpoint examples from the docs:
- `GET /api/v1/trades`: `3` to `12`
- `GET /api/v1/funding_rate/history`: `3`
- `GET /api/v1/positions`: `3`
- `GET /api/v1/trades/history`: `3`
- `GET /api/v1/orders`: `3`

When rate-limited:
- HTTP `429`

## Response Patterns

The docs commonly use:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "code": null
}
```

Paginated endpoints commonly add:

```json
{
  "next_cursor": "11114Lz77",
  "has_more": true
}
```

## REST Endpoints

## Markets

### `GET /api/v1/info`

Purpose:
- Returns exchange and market metadata for all tradable symbols.

Build notes:
- Use this to bootstrap market definitions.
- Expect symbol-level trading constraints and metadata here.

### `GET /api/v1/info/prices`

Purpose:
- Returns current price-related market info.

Documented data includes:
- mark price
- oracle price
- mid price
- funding info
- open interest
- 24h volume
- prior-day price references

Build notes:
- Good default source for dashboard market snapshots.

### `GET /api/v1/kline`

Purpose:
- Candle data for a symbol.

Query params:
- `symbol` required
- `interval` required
- `start_time` required
- `end_time` optional

Build notes:
- Historical chart endpoint.

### `GET /api/v1/kline/mark`

Purpose:
- Mark-price candles for a symbol.

Query params:
- `symbol` required
- `interval` required
- `start_time` required
- `end_time` optional

Build notes:
- Use this when charts need liquidation/funding-relevant mark prices instead of trade prices.

### `GET /api/v1/book`

Purpose:
- Order book snapshot for a symbol.

Query params:
- `symbol` required
- `agg_level` optional

Build notes:
- Use for L2-style book displays.

### `GET /api/v1/trades`

Purpose:
- Recent public trades for a symbol.

Query params:
- `symbol` required
- `limit` optional

Notable response note:
- Includes `last_order_id`.

### `GET /api/v1/funding_rate/history`

Purpose:
- Historical funding for a symbol.

Query params:
- `symbol` required
- `limit` optional, default `100`, max `4000`
- `cursor` optional

Returns:
- `oracle_price`
- `bid_impact_price`
- `ask_impact_price`
- `funding_rate`
- `next_funding_rate`
- `created_at`
- `next_cursor`
- `has_more`

## Account

### `GET /api/v1/account`

Purpose:
- High-level account overview.

Query params:
- `account` required

Documented fields include:
- `balance`
- `fee_level`
- `maker_fee`
- `taker_fee`
- `account_equity`
- `available_to_spend`
- `available_to_withdraw`
- `pending_balance`
- `total_margin_used`
- `cross_mmr`
- `positions_count`
- `orders_count`
- `stop_orders_count`
- stop-order trigger mode fields

Build notes:
- Best top-level account summary endpoint for balances and totals.

### `GET /api/v1/account/settings`

Purpose:
- Returns non-default margin and leverage settings.

Query params:
- `account` required

Response item fields:
- `symbol`
- `isolated`
- `leverage`
- `created_at`
- `updated_at`

Important:
- Markets still on default settings do not appear here.

### `POST /api/v1/account/leverage`

Signing type:
- `update_leverage`

Purpose:
- Set leverage for a market.

Common request fields:
- `account`
- `signature`
- `timestamp`
- `symbol`
- `leverage`
- `agent_wallet` optional
- `expiry_window` optional

### `POST /api/v1/account/margin`

Signing type:
- `update_margin_mode`

Purpose:
- Change margin mode for a market.

Common request fields:
- `account`
- `signature`
- `timestamp`
- `symbol`
- `is_isolated`
- `agent_wallet` optional
- `expiry_window` optional

### `GET /api/v1/positions`

Purpose:
- Returns current positions.

Query params:
- `account` required

Response item fields include:
- `symbol`
- `side`
- `amount`
- `entry_price`
- `margin`
- `funding`
- `isolated`
- `created_at`
- `updated_at`

Notable response note:
- Includes `last_order_id`.

### `GET /api/v1/trades/history`

Purpose:
- Returns account trade history.

Documented query shape from the mirror docs:
- `account` required
- `symbol` optional
- `start_time` optional
- `end_time` optional
- `limit` optional
- `cursor` optional

Build notes:
- Use for fills ledger and realized execution history.
- Includes `last_order_id` per docs.

### `GET /api/v1/funding/history`

Purpose:
- Returns funding payments for an account.

Query params:
- `account` required
- `symbol` optional
- `limit` optional
- `cursor` optional

Build notes:
- Useful for PnL attribution and accounting views.

### `GET /api/v1/portfolio`

Purpose:
- Account equity history.

Query params:
- `account` required
- `time_range` required: `1d`, `7d`, `14d`, `30d`, or `all`
- `start_time` optional
- `end_time` optional

Build notes:
- Use for account equity charts and period performance.

### `GET /api/v1/account/balance/history`

Purpose:
- Returns balance event history.

Query params:
- `account` required
- `limit` optional
- `cursor` optional

Response fields:
- `amount`
- `balance`
- `pending_balance`
- `event_type`
- `created_at`
- `next_cursor`
- `has_more`

Documented `event_type` values:
- `deposit`
- `deposit_release`
- `withdraw`
- `trade`
- `market_liquidation`
- `backstop_liquidation`
- `adl_liquidation`
- `subaccount_transfer`
- `funding`
- `payout`

### `POST /api/v1/account/withdraw`

Signing type:
- `withdraw`

Purpose:
- Request a withdrawal.

Common request fields:
- `account`
- `signature`
- `timestamp`
- `amount`
- `agent_wallet` optional
- `expiry_window` optional

Build notes:
- Docs describe the amount as USDC-denominated.

## Subaccounts

### `POST /api/v1/account/subaccount/create`

Signing types:
- `subaccount_initiate`
- `subaccount_confirm`

Purpose:
- Create a subaccount through a two-party signed flow.

Documented request fields:
- `main_account`
- `subaccount`
- `main_signature`
- `subaccount_signature`
- `timestamp`
- `expiry_window` optional

Build notes:
- This is more of a coordinated account-linking flow than a simple one-party create call.

### `POST /api/v1/account/subaccount/list`

Purpose:
- List subaccounts for a main account.

Documented request fields:
- `account`
- `signature`
- `timestamp`
- `expiry_window` optional

Build notes:
- Signed `POST`, not a `GET`.

### `POST /api/v1/account/subaccount/transfer`

Signing type:
- `subaccount_transfer`

Purpose:
- Transfer USDC between main and subaccounts.

Documented request fields:
- `account`
- `signature`
- `timestamp`
- `expiry_window` optional
- `to_account`
- `amount`

## Orders

### `POST /api/v1/orders/create_market`

Signing type:
- `create_market_order`

Purpose:
- Place a market order.

Documented request fields:
- `account`
- `signature`
- `timestamp`
- `symbol`
- `amount`
- `side`
- `slippage_percent`
- `reduce_only`
- `agent_wallet` optional
- `expiry_window` optional
- `tp` optional
- `sl` optional

Build notes:
- Docs mention around 200 ms delay before market orders are processed.
- Validate amount precision against `lot_size`.

### `POST /api/v1/orders/create`

Signing type:
- `create_order`

Purpose:
- Place a limit order.

Documented request fields:
- `account`
- `signature`
- `timestamp`
- `symbol`
- `price`
- `amount`
- `side`
- `tif`
- `reduce_only`
- `post_only` may be represented via `tif` variants in docs
- `client_order_id` optional
- `agent_wallet` optional
- `expiry_window` optional
- `tp` optional
- `sl` optional

Documented `tif` values:
- `GTC`
- `IOC`
- `ALO`
- `TOB`

Build notes:
- Validate both `tick_size` and `lot_size`.
- `client_order_id` is useful for idempotency and local reconciliation.

### `POST /api/v1/orders/stop/create`

Signing type:
- `create_stop_order`

Purpose:
- Place a stop order.

Documented shape:
- Standard signed envelope fields
- `stop_order` object with stop-specific fields

Build notes:
- Read the endpoint closely if we implement conditional orders; it uses a more nested payload than basic limit and market orders.

### `POST /api/v1/positions/tpsl`

Signing type:
- `set_position_tpsl`

Purpose:
- Set take-profit and stop-loss for an existing position.

Common request fields:
- `account`
- `signature`
- `timestamp`
- `symbol`
- TP and/or SL configuration
- `agent_wallet` optional
- `expiry_window` optional

Build notes:
- Docs mention platform limits for how many TP/SL entries are allowed.

### `POST /api/v1/orders/cancel`

Signing type:
- `cancel_order`

Purpose:
- Cancel a single order.

Documented request fields:
- `account`
- `signature`
- `timestamp`
- `order_id` or `client_order_id`
- `agent_wallet` optional
- `expiry_window` optional

Build notes:
- Prefer `client_order_id` support in our abstraction if we control order creation.

### `POST /api/v1/orders/cancel_all`

Signing type:
- `cancel_all_orders`

Purpose:
- Cancel all open orders, optionally filtered by symbol.

Documented request fields:
- `account`
- `signature`
- `timestamp`
- `all_symbols`
- `exclude_reduce_only`
- `symbol` required if `all_symbols` is `false`
- `agent_wallet` optional
- `expiry_window` optional

### `POST /api/v1/orders/stop/cancel`

Signing type:
- `cancel_stop_order`

Purpose:
- Cancel a stop order.

Build notes:
- Similar signed pattern to single-order cancel.

### `POST /api/v1/orders/edit`

Purpose:
- Edit an existing order.

Common request fields:
- `account`
- `signature`
- `timestamp`
- `order_id` or `client_order_id`
- edited values such as `price` and `amount`
- `agent_wallet` optional
- `expiry_window` optional

Build notes:
- Useful for amend flows instead of cancel-and-replace.

### `POST /api/v1/orders/batch`

Purpose:
- Submit multiple order actions atomically in sequence.

Request shape:
- `actions` array required
- each item has:
  - `type`
  - `data`

Documented action `type` values:
- `Create`
- `Cancel`

Important:
- This `type` is not the same as the signing operation type.
- The wrapper batch call is not signed as a whole.
- Individual actions carry their own signed payloads.

Build notes:
- Useful for coordinated multi-step order workflows.
- Docs state batched actions execute in listed order and are not interleaved by other users' orders.

### `GET /api/v1/orders`

Purpose:
- Returns open orders.

Query params:
- `account` required
- `symbol` optional

Notable response note:
- Includes `last_order_id`.

### `GET /api/v1/orders/history`

Purpose:
- Returns historical order events / order history summary.

Query params:
- `account` required
- `symbol` optional
- `limit` optional
- `cursor` optional

Build notes:
- Good for user order activity views.

### `GET /api/v1/orders/history_by_id`

Purpose:
- Returns complete history for one order ID.

Query params:
- `order_id` required

Documented response item fields include:
- `history_id`
- `order_id`
- `client_order_id`
- `symbol`
- `side`
- `price`
- `initial_amount`
- `filled_amount`
- `cancelled_amount`
- `event_type`
- `order_type`
- `order_status`
- `stop_price`
- `stop_parent_order_id`
- `reduce_only`
- `created_at`

Build notes:
- Useful when reconciling a single order lifecycle.

## Error Codes

The docs list general HTTP statuses:
- `400` bad request
- `403` forbidden
- `404` not found
- `409` conflict
- `422` unprocessable entity
- `429` too many requests
- `500` internal server error
- `503` service unavailable
- `504` gateway timeout

Documented business-logic `422` codes:

| Code | Name |
| --- | --- |
| `0` | `UNKNOWN` |
| `1` | `ACCOUNT_NOT_FOUND` |
| `2` | `BOOK_NOT_FOUND` |
| `3` | `INVALID_TICK_LEVEL` |
| `5` | `INSUFFICIENT_BALANCE` |
| `6` | `ORDER_NOT_FOUND` |
| `7` | `OVER_WITHDRAWAL` |
| `8` | `INVALID_LEVERAGE` |
| `9` | `CANNOT_UPDATE_MARGIN` |
| `10` | `POSITION_NOT_FOUND` |
| `11` | `POSITION_TPSL_LIMIT_EXCEEDED` |

## FAQ Notes That Affect Implementation

### `403` from CloudFront on `GET`

The docs note a common cause:
- sending an empty request body on `GET`

Implementation guidance:
- do not send a body with `GET` requests
- send query parameters only

### Delayed `account_positions` / `account_orders` on WebSocket

The docs say:
- snapshot channels can be delayed under load
- event-driven channels should be used for real-time state construction

Recommended approach:
1. initialize state from snapshot endpoints/channels
2. apply event-driven websocket updates for live state
3. use `last_order_id` for ordering/reconciliation where available

## Implementation Notes For Our Build

Suggested client architecture:
- `markets` client for public data
- `account` client for read-only account views
- `trading` client for signed order and settings mutations
- `signer` utility isolated behind a single interface
- `precision` utility for tick-size and lot-size rounding/validation
- `pagination` helper for cursor-based history endpoints
- `state-reconciler` layer that understands `last_order_id`

Suggested minimum validation before submitting orders:
- symbol exists
- amount matches `lot_size`
- price matches `tick_size` where applicable
- side is valid
- TIF is valid for order type
- timestamp is current
- signature generated from exactly the sent payload

Good first endpoints for integration testing:
1. `GET /api/v1/info`
2. `GET /api/v1/info/prices`
3. `GET /api/v1/book`
4. `GET /api/v1/account`
5. `GET /api/v1/positions`
6. one signed non-destructive write path if available in testnet

## Sources

- REST API root: https://pacifica.gitbook.io/docs/api-documentation/api/rest-api
- Markets: https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/markets
- Account: https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/account
- Subaccounts: https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/subaccounts
- Orders: https://pacifica.gitbook.io/docs/api-documentation/api/rest-api/orders
- Signing: https://pacifica.gitbook.io/docs/api-documentation/api/signing
- Operation Types: https://pacifica.gitbook.io/docs/api-documentation/api/signing/operation-types
- Error Handling: https://pacifica.gitbook.io/docs/api-documentation/api/signing/error-handling
- Rate limits: https://pacifica.gitbook.io/docs/api-documentation/api/rate-limits
- Market symbols: https://pacifica.gitbook.io/docs/api-documentation/api/market-symbols
- Tick and lot size: https://pacifica.gitbook.io/docs/api-documentation/api/tick-and-lot-size
- Last order ID: https://pacifica.gitbook.io/docs/api-documentation/api/last-order-id
- Error codes: https://pacifica.gitbook.io/docs/api-documentation/api/error-codes
- API FAQ: https://pacifica.gitbook.io/docs/api-documentation/api/api-faq
- 403 CloudFront: https://pacifica.gitbook.io/docs/api-documentation/api/api-faq/403-cloudfront
- Delayed account_positions: https://pacifica.gitbook.io/docs/api-documentation/api/api-faq/delayed-account_positions
- Trade history mirror: https://docs.pacifica.fi/api-documentation/api/rest-api/account/get-trade-history
- Order history mirror: https://docs.pacifica.fi/api-documentation/api/rest-api/orders/get-order-history
