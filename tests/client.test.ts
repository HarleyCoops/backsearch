import assert from "node:assert/strict";
import test from "node:test";
import { BacksearchClient } from "../src/client.js";
import { BacksearchApiError } from "../src/errors.js";

test("search sends the API key and normalized payload", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(
      JSON.stringify({
        mode: "hybrid",
        candidates: 1,
        hits: [],
        timing: { total_ms: 12 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const client = new BacksearchClient({
    apiKey: "or_test",
    fetch: fetcher,
  });

  await client.search({
    query: "  policy rate  ",
    as_of: "2026-01-15",
    k: 5,
  });

  assert.equal(requestUrl, "https://search.openreward.ai/search");
  assert.equal(new Headers(requestInit?.headers).get("x-api-key"), "or_test");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    query: "policy rate",
    as_of: "2026-01-15",
    k: 5,
  });
});

test("client turns provider errors into typed errors", async () => {
  const client = new BacksearchClient({
    apiKey: "or_test",
    fetch: async () =>
      new Response(JSON.stringify({ message: "Balance exhausted" }), {
        status: 402,
      }),
  });

  await assert.rejects(
    () => client.search({ query: "policy rate", as_of: "2026-01-15" }),
    (error: unknown) => {
      assert.ok(error instanceof BacksearchApiError);
      assert.equal(error.status, 402);
      assert.equal(error.code, "http-402");
      assert.equal(error.message, "Balance exhausted");
      return true;
    },
  );
});

test("client rejects contradictory domain filters before a request", async () => {
  let called = false;
  const client = new BacksearchClient({
    apiKey: "or_test",
    fetch: async () => {
      called = true;
      return new Response("{}");
    },
  });

  await assert.rejects(
    () =>
      client.search({
        query: "policy rate",
        as_of: "2026-01-15",
        allowed_domains: ["reuters.com"],
        blocked_domains: ["example.com"],
      }),
    /mutually exclusive/,
  );
  assert.equal(called, false);
});

test("usage builds the documented billing query", async () => {
  let requestUrl = "";
  const client = new BacksearchClient({
    apiKey: "or_test",
    fetch: async (input) => {
      requestUrl = String(input);
      return new Response(
        JSON.stringify({
          since: "2026-01-01",
          until: "2026-01-30",
          byService: [],
          totals: { requests: 0, cost: "0", pendingRequests: 0 },
        }),
      );
    },
  });

  await client.usage({
    days: 30,
    service: "search",
    granularity: "daily",
  });

  const url = new URL(requestUrl);
  assert.equal(url.pathname, "/v1/billing/api-usage");
  assert.equal(url.searchParams.get("days"), "30");
  assert.equal(url.searchParams.get("service"), "search");
  assert.equal(url.searchParams.get("granularity"), "daily");
});
