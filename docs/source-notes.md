# Source notes

Verified on July 24, 2026. This is an implementation notebook, not a promise that third-party endpoints will remain unchanged.

## OpenReward BackSearch

- API reference: <https://docs.openreward.ai/api-reference/backdated-search>
- Search: `POST https://search.openreward.ai/search`
- Fetch: `POST https://search.openreward.ai/fetch`
- Authentication: `x-api-key: or_...`
- Cutoff field: `as_of`
- Actual gate: `hits[].crawl_date`, not the article's best-effort `publish_date`
- Reported coverage during verification: December 2025 through June 2026

An unauthenticated request returned `401`, confirming that the local proxy must own the key.

## Unusual Whales

- Human/LLM docs: <https://api.unusualwhales.com/docs>
- OpenAPI YAML: <https://api.unusualwhales.com/api/openapi>
- Official MCP: <https://github.com/unusual-whales/unusual-whales-official-mcp>
- Authentication: `Authorization: Bearer ...`

The following representative routes were tested without a token and each returned `401`:

- `/api/congress/recent-trades`
- `/api/market/economic-calendar`
- `/api/stock/SPY/interpolated-iv?date=2026-01-15`

Conclusion: “public API” means a documented subscriber API, not anonymously open data.

Interesting point-in-time routes for a local subscriber:

| Route | Time control | Scenario |
| --- | --- | --- |
| `/api/congress/recent-trades` | transaction-date upper bound | Contrast transaction date with disclosure/report date |
| `/api/congress/congress-trader` | `date_from` and `date` | Inspect one member inside a bounded transaction window |
| `/api/congress/late-reports` | report-date upper bound | Quantify information delayed beyond the statutory window |
| `/api/stock/{ticker}/interpolated-iv` | `date` | Compare implied-risk state with contemporaneous reporting |
| `/api/stock/{ticker}/iv-rank` | `date`, `timespan` | Ask whether the options market priced an unusual regime |
| `/api/stock/{ticker}/volatility/realized` | `date`, `timeframe` | Compare ex-ante IV with later realized volatility carefully |
| `/api/market/market-tide` | `date`, one/five-minute interval | Place market-wide options pressure beside same-day evidence |
| `/api/market/fda-calendar` | announced/target date filters | Separate when a catalyst was announced from its target date |

The non-professional API agreement says access is for personal use and treats redistribution as including derived data. The repository therefore contains code only—no UW fixture data, cached response, screenshot, or public proxy route.

## CFTC Commitments of Traders

- Dataset: <https://publicreporting.cftc.gov/Commitments-of-Traders/TFF-Futures-Only/gpe5-46if>
- API: `https://publicreporting.cftc.gov/resource/gpe5-46if.json`
- Authentication: none
- Observation clock: `report_date_as_yyyy_mm_dd` (Tuesday)
- Normal release clock: Friday at 3:30 p.m. Eastern
- Official schedule: <https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm>

The TFF report covers financial futures and classifies open interest into dealer, asset-manager, leveraged-money, other-reportable, and non-reportable positions.

The signal-lab query:

1. shifts the date-only cutoff back six days before filtering report dates;
2. restricts market names to Bitcoin;
3. orders newest first;
4. attaches a conservative public date of the following Monday;
5. computes net positions from long minus short.

CFTC normally releases Tuesday observations on Friday, but holidays can delay publication. Because this project accepts a date rather than an intraday timestamp, it waits until the following Monday by default. This prevents ordinary Friday/holiday lookahead at the cost of some freshness. Consult the official release schedule for exact event-time work, and account separately for exceptional disruptions.

Weekly positioning is a state snapshot, not proof of intent, direction, or causation. The current API is also an observation-history surface, not a vintage database.

## U.S. Treasury Fiscal Data

- Dataset: <https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/>
- API: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny`
- Authentication: none
- Evidence clock: `record_date`

The client filters `record_date:lte:{as_of}`, sorts descending, and returns one record. Debt to the Penny is a business-day series; the nearest record can precede a weekend or holiday cutoff.

## SEC EDGAR

- Docs: <https://www.sec.gov/search-filings/edgar-application-programming-interfaces>
- Submissions: `https://data.sec.gov/submissions/CIK##########.json`
- Authentication: none
- Evidence clock: filing date and acceptance timestamp

SEC asks automated clients to identify themselves with a descriptive User-Agent. `data.sec.gov` does not support browser CORS, so a responsible integration belongs on the server.

A filing's period-of-report is not its availability time. Use the acceptance/filing timestamp when making an as-of claim.

## Kalshi

- Public market-data quickstart: <https://docs.kalshi.com/getting_started/quick_start_market_data>
- Historical data: <https://docs.kalshi.com/getting_started/historical_data>
- Base URL: `https://external-api.kalshi.com/trade-api/v2`
- Authentication: not required for public market-data endpoints
- Evidence clock: market/candlestick timestamps

Kalshi partitions older settled markets from the live routes. Read `/historical/cutoff`, then choose the live or historical route. Historical candlesticks require `start_ts`, `end_ts`, and `period_interval`.

## Polymarket

- API introduction: <https://docs.polymarket.com/api-reference/introduction>
- Batch price history: <https://docs.polymarket.com/api-reference/markets/get-batch-prices-history>
- Authentication: Gamma and Data APIs are public; CLOB read endpoints are public
- Evidence clock: price-history timestamp

Discovery and pricing use different identifiers: Gamma returns market metadata and CLOB token IDs; the CLOB history route consumes token IDs.

## openFDA

- Drug enforcement API: <https://open.fda.gov/apis/drug/enforcement/example-api-queries/>
- Endpoint: `https://api.fda.gov/drug/enforcement.json`
- Authentication: optional for light use
- Evidence clock: `report_date`

Recall and adverse-event records are not causal evidence. They should be used to establish what the agency had reported, with FDA's own limitations preserved.
