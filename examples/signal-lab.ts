import "dotenv/config";
import { parseArgs } from "node:util";
import { BacksearchClient } from "../src/client.js";
import { OpenDataClient } from "../src/open-data.js";

const { values } = parseArgs({
  options: {
    "as-of": { type: "string", default: "2026-01-15" },
    query: {
      type: "string",
      default: "Bitcoin institutional demand risk appetite ETF flows",
    },
    scenario: { type: "string", default: "bitcoin-crowding" },
  },
});

const backsearch = new BacksearchClient();
const openData = new OpenDataClient();
const asOf = values["as-of"];

if (values.scenario === "bitcoin-crowding") {
  const [positioning, news] = await Promise.all([
    openData.cftcBitcoinPositioningAsOf(asOf),
    backsearch.search({
      query: values.query,
      as_of: asOf,
      k: 8,
      mode: "hybrid",
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        scenario: "bitcoin-crowding",
        question:
          "Was leveraged money already crowded before the point-in-time news narrative?",
        asOf,
        cftc: positioning.map((row) => ({
          market: row.market_and_exchange_names,
          reportDate: row.report_date_as_yyyy_mm_dd,
          conservativePublicDate: row.conservative_public_date,
          openInterest: Number(row.open_interest_all),
          leveragedMoney: {
            long: Number(row.lev_money_positions_long),
            short: Number(row.lev_money_positions_short),
            net:
              Number(row.lev_money_positions_long) -
              Number(row.lev_money_positions_short),
          },
          assetManagers: {
            long: Number(row.asset_mgr_positions_long),
            short: Number(row.asset_mgr_positions_short),
            net:
              Number(row.asset_mgr_positions_long) -
              Number(row.asset_mgr_positions_short),
          },
        })),
        archiveEvidence: news.hits.map((hit) => ({
          title: hit.title,
          url: hit.url,
          crawlDate: hit.crawl_date,
        })),
      },
      null,
      2,
    ),
  );
} else if (values.scenario === "debt-clock") {
  const [debt, news] = await Promise.all([
    openData.treasuryDebtAsOf(asOf),
    backsearch.search({
      query: "US debt ceiling Treasury extraordinary measures",
      as_of: asOf,
      k: 8,
      mode: "hybrid",
    }),
  ]);
  console.log(
    JSON.stringify(
      {
        scenario: "debt-clock",
        question:
          "What debt balance had actually been published when this reporting appeared?",
        asOf,
        treasury: debt,
        archiveEvidence: news.hits.map((hit) => ({
          title: hit.title,
          url: hit.url,
          crawlDate: hit.crawl_date,
        })),
      },
      null,
      2,
    ),
  );
} else {
  throw new Error(
    `Unknown scenario "${values.scenario}". Use bitcoin-crowding or debt-clock.`,
  );
}
