import { BacksearchApiError } from "./errors.js";
import type {
  FetchRequest,
  FetchResponse,
  SearchRequest,
  SearchResponse,
  UsageRequest,
  UsageResponse,
} from "./types.js";

const DEFAULT_SEARCH_BASE_URL = "https://search.openreward.ai";
const DEFAULT_BILLING_BASE_URL = "https://api.openreward.ai";
const DEFAULT_TIMEOUT_MS = 30_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface BacksearchClientOptions {
  apiKey?: string;
  searchBaseUrl?: string;
  billingBaseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

function ensureIsoDate(value: string, field: string): void {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new BacksearchApiError(`${field} must be an ISO date (YYYY-MM-DD).`, {
      code: "invalid-date",
    });
  }
}

function requireApiKey(apiKey?: string): string {
  const resolved = apiKey?.trim() || process.env.OPENREWARD_API_KEY?.trim();
  if (!resolved) {
    throw new BacksearchApiError(
      "OPENREWARD_API_KEY is not configured. Copy .env.example to .env and add an OpenReward API key.",
      { code: "missing-api-key" },
    );
  }
  return resolved;
}

function validateSearchRequest(request: SearchRequest): void {
  if (request.query.trim().length < 2) {
    throw new BacksearchApiError("query must contain at least two characters.", {
      code: "invalid-query",
    });
  }
  ensureIsoDate(request.as_of, "as_of");
  if (request.k !== undefined && (!Number.isInteger(request.k) || request.k < 1)) {
    throw new BacksearchApiError("k must be a positive integer.", {
      code: "invalid-k",
    });
  }
  if (request.allowed_domains?.length && request.blocked_domains?.length) {
    throw new BacksearchApiError(
      "allowed_domains and blocked_domains are mutually exclusive.",
      { code: "conflicting-domain-filters" },
    );
  }
}

function validateFetchRequest(request: FetchRequest): void {
  ensureIsoDate(request.as_of, "as_of");
  let parsed: URL;
  try {
    parsed = new URL(request.url);
  } catch {
    throw new BacksearchApiError("url must be a valid HTTP(S) URL.", {
      code: "invalid-url",
    });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new BacksearchApiError("url must use HTTP or HTTPS.", {
      code: "invalid-url",
    });
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "detail", "error"]) {
      if (typeof record[key] === "string") return record[key];
    }
  }
  if (typeof body === "string" && body.trim()) return body;
  return `BackSearch request failed with HTTP ${status}.`;
}

export class BacksearchClient {
  private readonly apiKey: string;
  private readonly searchBaseUrl: string;
  private readonly billingBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: BacksearchClientOptions = {}) {
    this.apiKey = requireApiKey(options.apiKey);
    this.searchBaseUrl = (options.searchBaseUrl ?? DEFAULT_SEARCH_BASE_URL).replace(/\/$/, "");
    this.billingBaseUrl = (options.billingBaseUrl ?? DEFAULT_BILLING_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    validateSearchRequest(request);
    return this.request<SearchResponse>(`${this.searchBaseUrl}/search`, {
      method: "POST",
      body: JSON.stringify({ ...request, query: request.query.trim() }),
    });
  }

  async fetchPage(request: FetchRequest): Promise<FetchResponse> {
    validateFetchRequest(request);
    return this.request<FetchResponse>(`${this.searchBaseUrl}/fetch`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async usage(request: UsageRequest = {}): Promise<UsageResponse> {
    if (
      request.days !== undefined &&
      (!Number.isInteger(request.days) || request.days < 1 || request.days > 90)
    ) {
      throw new BacksearchApiError("days must be an integer from 1 to 90.", {
        code: "invalid-days",
      });
    }
    const query = new URLSearchParams();
    if (request.days !== undefined) query.set("days", String(request.days));
    if (request.service) query.set("service", request.service);
    if (request.granularity) query.set("granularity", request.granularity);
    const suffix = query.size ? `?${query.toString()}` : "";
    return this.request<UsageResponse>(
      `${this.billingBaseUrl}/v1/billing/api-usage${suffix}`,
      { method: "GET" },
    );
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          ...init.headers,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network failure";
      throw new BacksearchApiError(`Unable to reach BackSearch: ${message}`, {
        code: "network-error",
        details: error,
      });
    }

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new BacksearchApiError(errorMessage(response.status, body), {
        status: response.status,
        code: `http-${response.status}`,
        details: body,
      });
    }
    return body as T;
  }
}
