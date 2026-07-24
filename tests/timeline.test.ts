import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline, diffSnapshots } from "../src/timeline.js";
import type { SearchHit, TimelineSnapshot } from "../src/types.js";

function hit(url: string, title = url): SearchHit {
  return {
    url,
    title,
    snippet: "",
    crawl_date: "2026-01-01T00:00:00Z",
    publish_date: null,
    host: new URL(url).host,
    score: 1,
  };
}

const earlier: TimelineSnapshot = {
  asOf: "2026-01-01",
  hits: [hit("https://a.example/one"), hit("https://b.example/two")],
};
const later: TimelineSnapshot = {
  asOf: "2026-02-01",
  hits: [hit("https://b.example/two"), hit("https://c.example/three")],
};

test("diffSnapshots separates added, persisted, and dropped URLs", () => {
  const diff = diffSnapshots(earlier, later);
  assert.deepEqual(diff.added.map((item) => item.url), [
    "https://c.example/three",
  ]);
  assert.deepEqual(diff.persisted.map((item) => item.url), [
    "https://b.example/two",
  ]);
  assert.deepEqual(diff.dropped.map((item) => item.url), [
    "https://a.example/one",
  ]);
});

test("buildTimeline records first-seen date and repeated visibility", () => {
  const timeline = buildTimeline([later, earlier]);
  const repeated = timeline.find(
    (item) => item.url === "https://b.example/two",
  );
  assert.equal(repeated?.firstSeen, "2026-01-01");
  assert.deepEqual(repeated?.seenOn, ["2026-01-01", "2026-02-01"]);
});
