import "dotenv/config";
import { BacksearchClient } from "../src/client.js";
import { buildTimeline } from "../src/timeline.js";

const query =
  process.argv.slice(2).join(" ") ||
  "Bank of Japan interest rate policy decision";
const dates = ["2025-12-15", "2026-01-15", "2026-02-15"];
const client = new BacksearchClient();

console.log(`Building a point-in-time evidence timeline for: ${query}`);

const snapshots = await Promise.all(
  dates.map(async (asOf) => {
    const response = await client.search({
      query,
      as_of: asOf,
      k: 8,
      mode: "hybrid",
    });
    return { asOf, hits: response.hits };
  }),
);

const timeline = buildTimeline(snapshots);
for (const entry of timeline) {
  console.log(
    [
      entry.firstSeen,
      entry.host.padEnd(28),
      `${entry.seenOn.length}/${dates.length} snapshots`,
      entry.title,
      entry.url,
    ].join("  "),
  );
}
