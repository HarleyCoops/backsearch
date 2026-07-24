import "dotenv/config";
import { parseArgs } from "node:util";
import OpenAI from "openai";
import { BacksearchClient } from "../src/client.js";

const { values } = parseArgs({
  options: {
    "as-of": { type: "string", default: "2026-01-15" },
    model: {
      type: "string",
      default: process.env.OPENAI_MODEL ?? "gpt-5.6-sol",
    },
    question: {
      type: "string",
      default:
        "Where did the Bank of Japan's policy rate stand, and what evidence supported that conclusion?",
    },
  },
});

const cutoff = values["as-of"];
const openai = new OpenAI();
const archive = new BacksearchClient();

const tools = [
  {
    type: "function" as const,
    name: "search_archive",
    description:
      "Search the frozen news archive at the fixed research cutoff. Use one broad query first; search again only for a missing material fact.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A short, discriminative archive query.",
        },
        k: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Number of results.",
        },
      },
      required: ["query", "k"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "fetch_archive_page",
    description:
      "Read an archived page returned by search. Fetch only sources needed to support the answer.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Exact URL returned by search_archive.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
];

type InputItem = Record<string, unknown>;
let input: InputItem[] = [
  {
    role: "user",
    content: `Research cutoff: ${cutoff}\n\nQuestion: ${values.question}`,
  },
];

for (let turn = 0; turn < 8; turn += 1) {
  const response = await openai.responses.create({
    model: values.model,
    reasoning: { effort: "medium" },
    instructions: [
      "You are a point-in-time research analyst.",
      `Treat ${cutoff} as the hard knowledge boundary.`,
      "Use only evidence returned by the archive tools for factual claims.",
      "Cite every material historical claim with markdown links to retrieved URLs.",
      "Separate source-backed fact from inference. If evidence is insufficient, say what is missing.",
      "Stop when the core question is supported; do not search merely to improve phrasing.",
    ].join("\n"),
    input: input as never,
    tools,
  });

  const calls = response.output.filter(
    (item) => item.type === "function_call",
  );
  if (!calls.length) {
    console.log(response.output_text);
    break;
  }

  input.push(...(response.output as unknown as InputItem[]));
  for (const call of calls) {
    const args = JSON.parse(call.arguments) as {
      query?: string;
      k?: number;
      url?: string;
    };
    let output: unknown;
    if (call.name === "search_archive") {
      output = await archive.search({
        query: String(args.query),
        as_of: cutoff,
        k: args.k ?? 6,
        mode: "hybrid",
      });
    } else if (call.name === "fetch_archive_page") {
      const page = await archive.fetchPage({
        url: String(args.url),
        as_of: cutoff,
      });
      output = { ...page, text: page.text.slice(0, 12_000) };
    } else {
      output = { error: `Unknown tool ${call.name}` };
    }
    input.push({
      type: "function_call_output",
      call_id: call.call_id,
      output: JSON.stringify(output),
    });
  }
}
