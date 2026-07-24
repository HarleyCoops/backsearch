import { BacksearchApiError } from "./errors.js";

export interface UnusualWhalesClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface CongressTradesRequest {
  date?: string;
  ticker?: string;
  limit?: number;
}

export class UnusualWhalesClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: UnusualWhalesClientOptions = {}) {
    const apiKey = options.apiKey?.trim() || process.env.UW_API_KEY?.trim();
    if (!apiKey) {
      throw new BacksearchApiError(
        "UW_API_KEY is required for Unusual Whales. Its documented REST endpoints are not anonymous public endpoints.",
        { code: "missing-uw-api-key" },
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.unusualwhales.com").replace(
      /\/$/,
      "",
    );
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async congressTrades(request: CongressTradesRequest = {}): Promise<unknown> {
    const query = new URLSearchParams();
    if (request.date) query.set("date", request.date);
    if (request.ticker) query.set("ticker", request.ticker);
    if (request.limit) query.set("limit", String(request.limit));
    return this.get(`/api/congress/recent-trades?${query.toString()}`);
  }

  async interpolatedIv(ticker: string, date?: string): Promise<unknown> {
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    return this.get(
      `/api/stock/${encodeURIComponent(ticker.toUpperCase())}/interpolated-iv?${query.toString()}`,
    );
  }

  async ivRank(ticker: string, date?: string): Promise<unknown> {
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    return this.get(
      `/api/stock/${encodeURIComponent(ticker.toUpperCase())}/iv-rank?${query.toString()}`,
    );
  }

  async marketTide(date?: string): Promise<unknown> {
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    query.set("interval_5m", "true");
    return this.get(`/api/market/market-tide?${query.toString()}`);
  }

  private async get(path: string): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }
    if (!response.ok) {
      throw new BacksearchApiError(
        `Unusual Whales request failed with HTTP ${response.status}.`,
        {
          code: `uw-http-${response.status}`,
          status: response.status,
          details: body,
        },
      );
    }
    return body;
  }
}
