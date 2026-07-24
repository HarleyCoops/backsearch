import assert from "node:assert/strict";
import test from "node:test";
import { OpenDataClient } from "../src/open-data.js";

test("Treasury lookup applies an inclusive as-of filter", async () => {
  let requestUrl = "";
  const client = new OpenDataClient({
    fetch: async (input) => {
      requestUrl = String(input);
      return new Response(
        JSON.stringify({
          data: [
            {
              record_date: "2026-01-15",
              debt_held_public_amt: "1",
              intragov_hold_amt: "2",
              tot_pub_debt_out_amt: "3",
            },
          ],
        }),
      );
    },
  });
  const record = await client.treasuryDebtAsOf("2026-01-15");
  const url = new URL(requestUrl);

  assert.equal(url.searchParams.get("filter"), "record_date:lte:2026-01-15");
  assert.equal(url.searchParams.get("sort"), "-record_date");
  assert.equal(record?.record_date, "2026-01-15");
});

test("CFTC lookup uses a conservative public-availability boundary", async () => {
  let requestUrl = "";
  const client = new OpenDataClient({
    fetch: async (input) => {
      requestUrl = String(input);
      return new Response(
        JSON.stringify([
          {
            market_and_exchange_names: "BITCOIN - CME",
            report_date_as_yyyy_mm_dd: "2026-01-06T00:00:00.000",
            open_interest_all: "100",
            lev_money_positions_long: "10",
            lev_money_positions_short: "20",
            asset_mgr_positions_long: "30",
            asset_mgr_positions_short: "5",
          },
        ]),
      );
    },
  });
  const records = await client.cftcBitcoinPositioningAsOf("2026-01-15");
  const url = new URL(requestUrl);
  const where = url.searchParams.get("$where");

  assert.match(where ?? "", /report_date_as_yyyy_mm_dd <= '2026-01-09/);
  assert.match(where ?? "", /BITCOIN/);
  assert.equal(records[0]?.conservative_public_date, "2026-01-12");
});
