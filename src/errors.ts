export class BacksearchApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "BacksearchApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "backsearch-error";
    this.details = options.details;
  }
}
