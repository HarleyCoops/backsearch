#!/usr/bin/env node
import "dotenv/config";
import { parseArgs } from "node:util";
import { BacksearchClient } from "./client.js";
import { BacksearchApiError } from "./errors.js";
import type {
  FetchResponse,
  SearchMode,
  SearchResponse,
  UsageResponse,
} from "./types.js";

const HELP = `
BackSearch CLI — point-in-time web research

Usage:
  backsearch search --query "..." --as-of YYYY-MM-DD [options]
  backsearch fetch --url "https://..." --as-of YYYY-MM-DD [options]
  backsearch usage [--days 30] [--daily] [--service search|fetch]

Search options:
  -q, --query <text>        Search query
  -d, --as-of <date>       Inclusive archive cutoff
  -k, --count <number>     Results to return (default: 10)
      --mode <mode>        hybrid, bm25, or dense
      --site <host>        Restrict to one host
      --allow <host>       Allow a host (repeatable)
      --block <host>       Block a host (repeatable)
      --newest             Sort by newest instead of relevance

Fetch options:
  -u, --url <url>          Archived page URL
  -d, --as-of <date>       Inclusive archive cutoff
      --summarize          Ask BackSearch to summarize
      --prompt <text>      Guide the summary
      --include-html       Include archived HTML

Global:
      --json               Emit machine-readable JSON
  -h, --help               Show this help

Environment:
  OPENREWARD_API_KEY       Required OpenReward API key
`;

function formatSearch(response: SearchResponse): string {
  const lines = [
    `${response.hits.length} hits · ${response.mode} · ${response.timing.total_ms.toFixed(0)} ms`,
    "",
  ];
  response.hits.forEach((hit, index) => {
    lines.push(
      `${index + 1}. ${hit.title}`,
      `   ${hit.host} · archived ${hit.crawl_date.slice(0, 10)} · score ${hit.score.toFixed(3)}`,
      `   ${hit.url}`,
      `   ${hit.snippet.replace(/\s+/g, " ").trim()}`,
      "",
    );
  });
  return lines.join("\n").trimEnd();
}

function formatFetch(response: FetchResponse): string {
  return [
    response.title,
    `${response.host} · archived ${response.crawl_date}`,
    response.url,
    "",
    response.summary || response.text,
  ].join("\n");
}

function formatUsage(response: UsageResponse): string {
  const lines = [
    `Usage ${response.since.slice(0, 10)} → ${response.until.slice(0, 10)}`,
    "",
  ];
  for (const item of response.byService) {
    lines.push(
      `${item.service.padEnd(7)} ${String(item.requests).padStart(7)} requests  $${item.cost}`,
    );
  }
  lines.push("", `total   ${response.totals.requests} requests  $${response.totals.cost}`);
  return lines.join("\n");
}

function required(value: string | undefined, flag: string): string {
  if (!value) throw new Error(`${flag} is required.`);
  return value;
}

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP.trim());
    return;
  }

  const client = new BacksearchClient();

  if (command === "search") {
    const { values } = parseArgs({
      args: argv,
      options: {
        allow: { type: "string", multiple: true },
        "as-of": { type: "string", short: "d" },
        block: { type: "string", multiple: true },
        count: { type: "string", short: "k" },
        help: { type: "boolean", short: "h" },
        json: { type: "boolean" },
        mode: { type: "string", default: "hybrid" },
        newest: { type: "boolean" },
        query: { type: "string", short: "q" },
        site: { type: "string" },
      },
      strict: true,
    });
    if (values.help) {
      console.log(HELP.trim());
      return;
    }
    const response = await client.search({
      query: required(values.query, "--query"),
      as_of: required(values["as-of"], "--as-of"),
      k: values.count ? Number(values.count) : 10,
      mode: values.mode as SearchMode,
      site: values.site,
      allowed_domains: values.allow,
      blocked_domains: values.block,
      sort: values.newest ? "newest" : "relevance",
    });
    console.log(values.json ? JSON.stringify(response, null, 2) : formatSearch(response));
    return;
  }

  if (command === "fetch") {
    const { values } = parseArgs({
      args: argv,
      options: {
        "as-of": { type: "string", short: "d" },
        help: { type: "boolean", short: "h" },
        "include-html": { type: "boolean" },
        json: { type: "boolean" },
        prompt: { type: "string" },
        summarize: { type: "boolean" },
        url: { type: "string", short: "u" },
      },
      strict: true,
    });
    if (values.help) {
      console.log(HELP.trim());
      return;
    }
    const response = await client.fetchPage({
      url: required(values.url, "--url"),
      as_of: required(values["as-of"], "--as-of"),
      summarize: values.summarize,
      prompt: values.prompt,
      include_html: values["include-html"],
    });
    console.log(values.json ? JSON.stringify(response, null, 2) : formatFetch(response));
    return;
  }

  if (command === "usage") {
    const { values } = parseArgs({
      args: argv,
      options: {
        daily: { type: "boolean" },
        days: { type: "string" },
        help: { type: "boolean", short: "h" },
        json: { type: "boolean" },
        service: { type: "string" },
      },
      strict: true,
    });
    if (values.help) {
      console.log(HELP.trim());
      return;
    }
    if (values.service && !["search", "fetch"].includes(values.service)) {
      throw new Error("--service must be search or fetch.");
    }
    const response = await client.usage({
      days: values.days ? Number(values.days) : 30,
      service: values.service as "search" | "fetch" | undefined,
      granularity: values.daily ? "daily" : "total",
    });
    console.log(values.json ? JSON.stringify(response, null, 2) : formatUsage(response));
    return;
  }

  throw new Error(`Unknown command "${command}".\n\n${HELP.trim()}`);
}

main().catch((error: unknown) => {
  if (error instanceof BacksearchApiError) {
    console.error(`BackSearch error [${error.code}]: ${error.message}`);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
});
