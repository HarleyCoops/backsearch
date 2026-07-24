export type SourceAccess = "open" | "key-optional" | "paid-key";

export interface SignalSource {
  id: string;
  name: string;
  owner: string;
  access: SourceAccess;
  endpoint: string;
  docsUrl: string;
  timestampField: string;
  scenario: string;
  caveat: string;
  accent: "lime" | "coral" | "violet" | "cyan";
}

export const SIGNAL_SOURCES: SignalSource[] = [
  {
    id: "cftc-cot",
    name: "Commitments of Traders",
    owner: "U.S. CFTC",
    access: "open",
    endpoint: "https://publicreporting.cftc.gov/resource/gpe5-46if.json",
    docsUrl:
      "https://publicreporting.cftc.gov/Commitments-of-Traders/TFF-Futures-Only/gpe5-46if",
    timestampField: "report date + conservative release lag",
    scenario:
      "Was leveraged money already crowded into—or shorting—a macro trade before the press narrative caught up?",
    caveat:
      "Tuesday observation, usually released Friday. The client uses the following Monday as a conservative daily boundary; verify the official schedule for exact work.",
    accent: "lime",
  },
  {
    id: "treasury-debt",
    name: "Debt to the Penny",
    owner: "U.S. Treasury",
    access: "open",
    endpoint:
      "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny",
    docsUrl: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
    timestampField: "record_date",
    scenario:
      "Replay debt-ceiling reporting against the exact debt balance that had been published on each day.",
    caveat:
      "Business-day series published with a one-business-day reporting cadence.",
    accent: "cyan",
  },
  {
    id: "sec-edgar",
    name: "EDGAR submissions",
    owner: "U.S. SEC",
    access: "open",
    endpoint: "https://data.sec.gov/submissions/CIK##########.json",
    docsUrl:
      "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    timestampField: "filingDate / acceptanceDateTime",
    scenario:
      "Measure how long an 8-K, Form 4, or 13F filing existed before it appeared in searchable reporting.",
    caveat:
      "Requires an identifying User-Agent and server-side access; data.sec.gov does not support browser CORS.",
    accent: "violet",
  },
  {
    id: "kalshi-history",
    name: "Historical event markets",
    owner: "Kalshi",
    access: "open",
    endpoint:
      "https://external-api.kalshi.com/trade-api/v2/historical/markets/{ticker}/candlesticks",
    docsUrl:
      "https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks",
    timestampField: "end_period_ts",
    scenario:
      "Freeze the crowd probability for a CPI, Fed, climate, or election contract and audit what public evidence justified that price.",
    caveat:
      "Archived and live markets use different routes; first read the historical cutoff endpoint.",
    accent: "coral",
  },
  {
    id: "polymarket-history",
    name: "Prediction-market price history",
    owner: "Polymarket",
    access: "open",
    endpoint: "https://clob.polymarket.com/batch-prices-history",
    docsUrl:
      "https://docs.polymarket.com/api-reference/markets/get-batch-prices-history",
    timestampField: "t",
    scenario:
      "Compare the probability path of a market to the point-in-time news evidence available at the same cutoff.",
    caveat:
      "Discovery uses Gamma market IDs; price history uses CLOB token IDs.",
    accent: "violet",
  },
  {
    id: "openfda-recalls",
    name: "Drug enforcement reports",
    owner: "U.S. FDA",
    access: "key-optional",
    endpoint: "https://api.fda.gov/drug/enforcement.json",
    docsUrl: "https://open.fda.gov/apis/drug/enforcement/example-api-queries/",
    timestampField: "report_date",
    scenario:
      "Trace when a recall became official, when it reached the news archive, and whether market chatter led or lagged.",
    caveat:
      "Records are enforcement reports, not causal evidence. A key is optional but recommended for regular use.",
    accent: "coral",
  },
  {
    id: "uw-congress",
    name: "Congress disclosure feed",
    owner: "Unusual Whales",
    access: "paid-key",
    endpoint: "https://api.unusualwhales.com/api/congress/recent-trades",
    docsUrl:
      "https://api.unusualwhales.com/docs/operations/PublicApi.CongressController.congress_recent_trades",
    timestampField: "transaction_date + report_date",
    scenario:
      "Prove the disclosure-lag trap: a transaction date is not the date the public could have known about the trade.",
    caveat:
      "Authenticated personal-use data. Do not redistribute raw or derived UW data from this project.",
    accent: "lime",
  },
  {
    id: "uw-volatility",
    name: "Point-in-time IV regime",
    owner: "Unusual Whales",
    access: "paid-key",
    endpoint:
      "https://api.unusualwhales.com/api/stock/{ticker}/interpolated-iv?date={date}",
    docsUrl:
      "https://api.unusualwhales.com/docs/operations/PublicApi.TickerController.interpolated_iv",
    timestampField: "date",
    scenario:
      "Ask whether options implied a regime break before journalists had enough evidence to describe one.",
    caveat:
      "Authenticated personal-use data. Keep results local and respect the account tier's lookback.",
    accent: "cyan",
  },
];
