import "dotenv/config";
import { parseArgs } from "node:util";
import { BacksearchClient } from "../src/client.js";
import { UnusualWhalesClient } from "../src/unusual-whales.js";

const { values } = parseArgs({
  options: {
    "as-of": { type: "string", default: "2026-06-30" },
    ticker: { type: "string" },
  },
});

const uw = new UnusualWhalesClient();
const backsearch = new BacksearchClient();
const raw = await uw.congressTrades({
  date: values["as-of"],
  ticker: values.ticker,
  limit: 1,
});

function findRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    );
  }
  if (value && typeof value === "object") {
    for (const key of ["data", "results", "trades"]) {
      const nested = (value as Record<string, unknown>)[key];
      const rows = findRows(nested);
      if (rows.length) return rows;
    }
  }
  return [];
}

const trade = findRows(raw)[0];
if (!trade) throw new Error("Unusual Whales returned no matching trades.");

const reportDate = String(
  trade.report_date ?? trade.reported_at ?? trade.filed_at ?? "",
).slice(0, 10);
const transactionDate = String(
  trade.transaction_date ?? trade.traded ?? trade.trade_date ?? "",
).slice(0, 10);
const ticker = String(trade.ticker ?? values.ticker ?? "").toUpperCase();
const politician = String(
  trade.member_name ?? trade.name ?? trade.politician ?? "member of Congress",
);

if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
  throw new Error(
    "Could not identify a disclosure/report date in the returned trade.",
  );
}

const evidence = await backsearch.search({
  query: `${ticker} ${politician} congressional stock trade disclosure`,
  as_of: reportDate,
  k: 8,
  mode: "hybrid",
});

console.log(
  JSON.stringify(
    {
      method:
        "The disclosure/report date—not the transaction date—is the first safe cutoff for public-knowledge research.",
      transactionDate,
      reportDate,
      disclosureLagDays:
        (Date.parse(`${reportDate}T00:00:00Z`) -
          Date.parse(`${transactionDate}T00:00:00Z`)) /
        86_400_000,
      ticker,
      politician,
      archiveEvidenceAsOfDisclosure: evidence.hits.map((hit) => ({
        title: hit.title,
        url: hit.url,
        crawlDate: hit.crawl_date,
      })),
    },
    null,
    2,
  ),
);
