import { BacksearchApiError } from "./errors.js";

export interface OpenDataClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface TreasuryDebtRecord {
  record_date: string;
  debt_held_public_amt: string;
  intragov_hold_amt: string;
  tot_pub_debt_out_amt: string;
}

export interface CftcPositionRecord {
  market_and_exchange_names: string;
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  lev_money_positions_long: string;
  lev_money_positions_short: string;
  asset_mgr_positions_long: string;
  asset_mgr_positions_short: string;
}

export interface CftcPositionSnapshot extends CftcPositionRecord {
  /**
   * Conservative daily availability boundary. CFTC normally releases Tuesday
   * observations on Friday, but holidays can push publication into Monday.
   */
  conservative_public_date: string;
}

export interface OpenFdaRecall {
  recall_number: string;
  report_date: string;
  classification: string;
  recalling_firm: string;
  product_description: string;
  reason_for_recall: string;
  status: string;
}

interface TreasuryResponse {
  data: TreasuryDebtRecord[];
}

interface OpenFdaResponse {
  results: OpenFdaRecall[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string): void {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new BacksearchApiError("Date must use YYYY-MM-DD.", {
      code: "invalid-date",
    });
  }
}

function shiftUtcDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export class OpenDataClient {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: OpenDataClientOptions = {}) {
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async treasuryDebtAsOf(asOf: string): Promise<TreasuryDebtRecord | null> {
    assertDate(asOf);
    const url = new URL(
      "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny",
    );
    url.searchParams.set("filter", `record_date:lte:${asOf}`);
    url.searchParams.set("sort", "-record_date");
    url.searchParams.set("page[size]", "1");
    const response = await this.getJson<TreasuryResponse>(url);
    return response.data[0] ?? null;
  }

  async cftcBitcoinPositioningAsOf(
    asOf: string,
  ): Promise<CftcPositionSnapshot[]> {
    assertDate(asOf);
    // COT observations are dated Tuesday and normally released Friday at
    // 3:30 p.m. ET. Date-only research cannot represent that intraday boundary,
    // and holiday releases can slip to Monday, so default to the following
    // Monday (report date + 6 days). This is intentionally conservative.
    const latestSafeReportDate = shiftUtcDate(asOf, -6);
    const url = new URL(
      "https://publicreporting.cftc.gov/resource/gpe5-46if.json",
    );
    url.searchParams.set("$limit", "10");
    url.searchParams.set(
      "$where",
      `report_date_as_yyyy_mm_dd <= '${latestSafeReportDate}T00:00:00.000' AND upper(market_and_exchange_names) like '%BITCOIN%'`,
    );
    url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
    url.searchParams.set(
      "$select",
      [
        "market_and_exchange_names",
        "report_date_as_yyyy_mm_dd",
        "open_interest_all",
        "lev_money_positions_long",
        "lev_money_positions_short",
        "asset_mgr_positions_long",
        "asset_mgr_positions_short",
      ].join(","),
    );
    const records = await this.getJson<CftcPositionRecord[]>(url);
    return records.map((record) => ({
      ...record,
      conservative_public_date: shiftUtcDate(
        record.report_date_as_yyyy_mm_dd.slice(0, 10),
        6,
      ),
    }));
  }

  async drugRecalls(
    startDate: string,
    endDate: string,
    limit = 5,
  ): Promise<OpenFdaRecall[]> {
    assertDate(startDate);
    assertDate(endDate);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BacksearchApiError("limit must be an integer from 1 to 100.", {
        code: "invalid-limit",
      });
    }
    const url = new URL("https://api.fda.gov/drug/enforcement.json");
    const compactStart = startDate.replaceAll("-", "");
    const compactEnd = endDate.replaceAll("-", "");
    url.searchParams.set(
      "search",
      `report_date:[${compactStart} TO ${compactEnd}]`,
    );
    url.searchParams.set("limit", String(limit));
    const response = await this.getJson<OpenFdaResponse>(url);
    return response.results;
  }

  private async getJson<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: {
          accept: "application/json",
          "user-agent": "backsearch-developer-kit/0.1 (public research tool)",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new BacksearchApiError("Open-data request failed.", {
        code: "open-data-network-error",
        details: error,
      });
    }
    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }
    if (!response.ok) {
      throw new BacksearchApiError(
        `Open-data request failed with HTTP ${response.status}.`,
        {
          code: `open-data-http-${response.status}`,
          status: response.status,
          details: body,
        },
      );
    }
    return body as T;
  }
}
