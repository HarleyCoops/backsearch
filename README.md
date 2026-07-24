# backsearch/lab

A developer workbench for asking a deceptively hard question:

> What could a careful researcher have known on a specific date?

This repository wraps [OpenReward BackSearch](https://docs.openreward.ai/api-reference/backdated-search) with:

- an interactive search, compare, and archived-page playground;
- a strict TypeScript client and command-line interface;
- leakage checks that fail when evidence crosses the cutoff;
- an OpenAI Responses API research-agent example;
- an as-of signal lab built around CFTC, Treasury, SEC, prediction-market, FDA, and optional Unusual Whales data.

This is an unofficial developer project. BackSearch is a General Reasoning / OpenReward product.

## Why this exists

Ordinary historical research is surprisingly easy to contaminate. Search engines rank pages using present-day signals. Articles are edited. Later explainers dominate older sources. A dataset's event date is often not the date it became public.

BackSearch uses a frozen archive and gates results on `crawl_date`. The workbench adds an operating rule:

```text
admissible evidence time = max(source publication time, archive crawl time, data release time)
```

That distinction matters for backtests, forecasts, agent evaluations, disclosure analysis, and any claim containing the words “as of.”

## Quick start

Requirements: Node.js 20+ and an OpenReward account/API key.

```bash
npm install
cp .env.example .env
```

Add your key to `.env`:

```dotenv
OPENREWARD_API_KEY=or_xxxxxxxx
```

Then launch the workbench:

```bash
npm run dev
```

Open `http://127.0.0.1:4317`.

The server binds to localhost by default. Provider keys stay in the Node process and never enter browser JavaScript.

## CLI

```bash
npm run cli -- search \
  --query "Bank of Japan interest rate policy decision" \
  --as-of 2026-01-15 \
  --count 5
```

Fetch the archived version of a returned page:

```bash
npm run cli -- fetch \
  --url "https://example.com/article" \
  --as-of 2026-01-15
```

Inspect metered usage:

```bash
npm run cli -- usage --days 30 --daily
```

Add `--json` to any command for machine-readable output.

## TypeScript client

```ts
import { BacksearchClient } from "./src/client.js";

const backsearch = new BacksearchClient();
const response = await backsearch.search({
  query: "central bank statement interest rates",
  as_of: "2026-01-15",
  k: 5,
  mode: "hybrid",
});

for (const hit of response.hits) {
  console.log(hit.crawl_date, hit.title, hit.url);
}
```

`BacksearchClient` supports:

- `search(...)` → `POST https://search.openreward.ai/search`
- `fetchPage(...)` → `POST https://search.openreward.ai/fetch`
- `usage(...)` → `GET https://api.openreward.ai/v1/billing/api-usage`

Provider errors become `BacksearchApiError` instances with stable `code`, `status`, and `details` fields.

## The recipes

### 1. Evidence timeline

Run the same query at three cutoffs and identify when each URL first becomes visible:

```bash
npm run example:timeline -- "Bank of Japan policy rate"
```

Cost at documented pricing: three search requests, or $0.03.

### 2. Lookahead-leakage audit

Search, fetch the top result, and assert that every `crawl_date` is at or before the declared cutoff:

```bash
npm run example:audit -- \
  --query "central bank statement interest rates" \
  --as-of 2026-01-15
```

### 3. Point-in-time research agent

The agent exposes BackSearch as two strict function tools through the OpenAI Responses API. The cutoff lives in the runtime rather than model-selected arguments, so the model cannot silently move the clock.

```bash
# Also set OPENAI_API_KEY in .env
npm run example:agent -- \
  --as-of 2026-01-15 \
  --question "Where did the Bank of Japan's policy rate stand?"
```

The default is `gpt-5.6-sol`; override it with `OPENAI_MODEL` or `--model`.

### 4. Open-data signal lab

This combines a no-key CFTC dataset with BackSearch. It takes the latest Bitcoin futures positioning report conservatively available by the cutoff, calculates leveraged-money and asset-manager net positions, and places the result next to the contemporaneous news evidence.

```bash
npm run example:signals -- \
  --scenario bitcoin-crowding \
  --as-of 2026-01-15
```

A Treasury debt-clock variant is also included:

```bash
npm run example:signals -- \
  --scenario debt-clock \
  --as-of 2026-01-15
```

### 5. Congress disclosure-lag clock

This optional recipe uses a personal Unusual Whales API key:

```dotenv
UW_API_KEY=your_key
```

```bash
npm run example:disclosure -- --as-of 2026-06-30
```

It deliberately uses the disclosure/report date—not the transaction date—as the earliest safe public-knowledge cutoff. Unusual Whales requires authentication, and its non-professional agreement restricts redistribution of raw and derived data. The example runs locally, prints no bundled fixture, and should not be exposed as a public data proxy.

## Signal-source matrix

| Source | Access | Evidence clock | Good as-of question |
| --- | --- | --- | --- |
| CFTC TFF COT | Open, no key | conservative public date after Tuesday observation | Was leveraged money already crowded before the narrative? |
| Treasury Debt to the Penny | Open, no key | `record_date` | What published debt balance existed beside that headline? |
| SEC EDGAR submissions | Open, no key | filing/acceptance time | How long did a filing exist before press coverage? |
| Kalshi historical markets | Public market-data routes | candlestick end time | What probability did the crowd assign using then-available evidence? |
| Polymarket CLOB history | Public read routes | history timestamp | Did market belief move before or after the archive did? |
| openFDA enforcement | Key optional | `report_date` | When did a recall become official versus searchable news? |
| Unusual Whales Congress | Paid/personal key | transaction + report dates | How large was the disclosure-lag trap? |
| Unusual Whales IV/tide | Paid/personal key | market date/minute | Did implied volatility move before the story formed? |

See [docs/source-notes.md](docs/source-notes.md) for verified endpoints and caveats.

## Coverage, pricing, and costs

As documented on July 24, 2026:

- archive coverage: December 2025 through June 2026;
- search: $0.01 per successful request;
- fetch: $0.002 per successful request;
- unsuccessful searches and `404` fetch misses are not billed;
- requests return `402` when the prepaid OpenReward balance is exhausted.

Coverage and pricing can change. Check the [canonical API reference](https://docs.openreward.ai/api-reference/backdated-search) before budgeting a run.

The portal displays the incremental request cost before each action. Compare mode performs two searches.

## Security model

- `.env` files are ignored by Git.
- The browser only calls the local `/api/*` proxy.
- Search/fetch payloads are validated and size-limited.
- The server binds to `127.0.0.1` unless `HOST` is explicitly changed.
- API routes are rate-limited to 30 requests per minute per client.
- Set `BACKSEARCH_ACCESS_TOKEN` before exposing the server beyond localhost.
- Set `BACKSEARCH_ALLOWED_ORIGIN` for an intentional remote deployment.
- Unusual Whales data is never stored or redistributed by the included connector.

Do not deploy this server publicly with a funded provider key and no access control.

## Development

```bash
npm run typecheck
npm test
npm run build
```

Or run all checks:

```bash
npm run check
```

## Project map

```text
public/                   interactive workbench
src/client.ts             typed BackSearch client
src/cli.ts                command-line interface
src/server.ts             local validated proxy
src/open-data.ts          genuinely open point-in-time sources
src/unusual-whales.ts     optional authenticated local connector
src/sources.ts            source/scenario registry
examples/                 runnable research recipes
tests/                    client and time-boundary tests
docs/                     methodology and endpoint notes
```

## License

MIT. Provider data remains subject to each provider's own terms and licenses.
