import assert from "node:assert/strict";
import test from "node:test";
import { UnusualWhalesClient } from "../src/unusual-whales.js";

test("Unusual Whales connector requires an explicit paid API key", () => {
  assert.throws(
    () => new UnusualWhalesClient({ apiKey: "" }),
    /documented REST endpoints are not anonymous/,
  );
});

test("Unusual Whales connector uses bearer authentication", async () => {
  let authorization = "";
  const client = new UnusualWhalesClient({
    apiKey: "uw_test",
    fetch: async (_input, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ data: [] }));
    },
  });
  await client.congressTrades({ limit: 1 });
  assert.equal(authorization, "Bearer uw_test");
});
