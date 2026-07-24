import "dotenv/config";
import { parseArgs } from "node:util";
import { BacksearchClient } from "../src/client.js";

const { values } = parseArgs({
  options: {
    "as-of": { type: "string", default: "2026-01-15" },
    count: { type: "string", default: "10" },
    query: {
      type: "string",
      default: "central bank statement interest rates",
    },
  },
});

const asOf = values["as-of"];
const client = new BacksearchClient();
const search = await client.search({
  query: values.query,
  as_of: asOf,
  k: Number(values.count),
  mode: "hybrid",
});

const cutoff = Date.parse(`${asOf}T23:59:59.999Z`);
const violations = search.hits.filter(
  (hit) => Date.parse(hit.crawl_date) > cutoff,
);

const top = search.hits[0];
const fetched = top
  ? await client.fetchPage({
      url: top.url,
      as_of: asOf,
    })
  : null;

const audit = {
  query: values.query,
  asOf,
  search: {
    resultCount: search.hits.length,
    maxCrawlDate:
      search.hits.map((hit) => hit.crawl_date).sort().at(-1) ?? null,
    passed: violations.length === 0,
    violations: violations.map((hit) => ({
      url: hit.url,
      crawlDate: hit.crawl_date,
    })),
  },
  fetch: fetched
    ? {
        url: fetched.url,
        crawlDate: fetched.crawl_date,
        passed: Date.parse(fetched.crawl_date) <= cutoff,
      }
    : null,
};

console.log(JSON.stringify(audit, null, 2));
if (!audit.search.passed || audit.fetch?.passed === false) {
  process.exitCode = 1;
}
