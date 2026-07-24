import "dotenv/config";
import path from "node:path";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import { BacksearchClient } from "./client.js";
import { BacksearchApiError } from "./errors.js";
import { SIGNAL_SOURCES } from "./sources.js";

const app = express();
const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST ?? "127.0.0.1";
const accessToken = process.env.BACKSEARCH_ACCESS_TOKEN?.trim();
const allowedOrigin = process.env.BACKSEARCH_ALLOWED_ORIGIN?.trim();
const publicDirectory = path.resolve(process.cwd(), "public");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const searchSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    as_of: isoDate,
    k: z.number().int().min(1).max(25).default(10),
    mode: z.enum(["hybrid", "bm25", "dense"]).default("hybrid"),
    lang: z.string().length(2).optional(),
    site: z.string().max(253).optional(),
    allowed_domains: z.array(z.string().max(253)).max(20).optional(),
    blocked_domains: z.array(z.string().max(253)).max(20).optional(),
    sort: z.enum(["relevance", "newest"]).default("relevance"),
  })
  .refine(
    (value) => !(value.allowed_domains?.length && value.blocked_domains?.length),
    "allowed_domains and blocked_domains are mutually exclusive",
  );

const fetchSchema = z.object({
  url: z.url(),
  as_of: isoDate,
  summarize: z.boolean().default(false),
  prompt: z.string().max(1_000).optional(),
  include_html: z.boolean().default(false),
});

const rateWindow = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function rateLimit(request: Request, response: Response, next: NextFunction): void {
  const now = Date.now();
  const key = request.ip ?? "unknown";
  const existing = rateWindow.get(key);
  if (!existing || existing.resetAt <= now) {
    rateWindow.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    next();
    return;
  }
  existing.count += 1;
  if (existing.count > RATE_LIMIT) {
    response.status(429).json({
      error: "rate-limit",
      message: "Portal rate limit exceeded. Try again in one minute.",
    });
    return;
  }
  next();
}

function protectApi(request: Request, response: Response, next: NextFunction): void {
  if (allowedOrigin && request.get("origin") && request.get("origin") !== allowedOrigin) {
    response.status(403).json({
      error: "origin-denied",
      message: "This origin is not allowed.",
    });
    return;
  }
  if (accessToken && request.get("x-access-token") !== accessToken) {
    response.status(401).json({
      error: "portal-auth-required",
      message: "A valid portal access token is required.",
    });
    return;
  }
  next();
}

function getClient(): BacksearchClient {
  return new BacksearchClient();
}

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use("/api", rateLimit);

app.get("/api/status", (_request, response) => {
  response.json({
    connected: Boolean(process.env.OPENREWARD_API_KEY?.trim()),
    requiresAccessToken: Boolean(accessToken),
    coverage: {
      from: "2025-12-01",
      through: "2026-06-30",
      note: "Coverage is provider-reported and may expand.",
    },
    pricing: {
      search: 0.01,
      fetch: 0.002,
      currency: "USD",
    },
  });
});

app.get("/api/sources", (_request, response) => {
  response.json({ sources: SIGNAL_SOURCES });
});

app.use("/api", protectApi);

app.post("/api/search", async (request, response, next) => {
  try {
    const input = searchSchema.parse(request.body);
    response.json(await getClient().search(input));
  } catch (error) {
    next(error);
  }
});

app.post("/api/fetch", async (request, response, next) => {
  try {
    const input = fetchSchema.parse(request.body);
    response.json(await getClient().fetchPage(input));
  } catch (error) {
    next(error);
  }
});

app.get("/api/usage", async (request, response, next) => {
  try {
    const days = Math.min(Math.max(Number(request.query.days ?? 30), 1), 90);
    response.json(
      await getClient().usage({ days, granularity: "daily" }),
    );
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDirectory, { extensions: ["html"] }));

app.get("/{*splat}", (_request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "invalid-request",
        message: error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    if (error instanceof BacksearchApiError) {
      response.status(error.status || 500).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    console.error(error);
    response.status(500).json({
      error: "internal-error",
      message: "The portal could not complete this request.",
    });
  },
);

app.listen(port, host, () => {
  console.log(`BackSearch portal listening at http://${host}:${port}`);
  if (host !== "127.0.0.1" && host !== "localhost" && !accessToken) {
    console.warn(
      "Security warning: set BACKSEARCH_ACCESS_TOKEN before exposing this server beyond localhost.",
    );
  }
});
