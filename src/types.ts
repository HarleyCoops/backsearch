export type SearchMode = "hybrid" | "bm25" | "dense";
export type SearchSort = "relevance" | "newest";
export type UsageService = "search" | "fetch";
export type UsageGranularity = "total" | "daily";

export interface SearchRequest {
  query: string;
  as_of: string;
  k?: number;
  mode?: SearchMode;
  lang?: string;
  site?: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
  sort?: SearchSort;
}

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  crawl_date: string;
  publish_date: string | null;
  host: string;
  score: number;
}

export interface SearchResponse {
  mode: SearchMode;
  candidates: number;
  hits: SearchHit[];
  timing: {
    total_ms: number;
  };
}

export interface FetchRequest {
  url: string;
  as_of: string;
  summarize?: boolean;
  prompt?: string;
  include_html?: boolean;
}

export interface FetchResponse {
  url: string;
  crawl_date: string;
  publish_date: string | null;
  title: string;
  text: string;
  summary: string | null;
  host: string;
  html?: string;
}

export interface UsageRequest {
  days?: number;
  service?: UsageService;
  granularity?: UsageGranularity;
}

export interface UsageServiceTotal {
  service: UsageService;
  requests: number;
  units: string;
  cost: string;
  pendingRequests: number;
}

export interface UsageResponse {
  since: string;
  until: string;
  byService: UsageServiceTotal[];
  totals: {
    requests: number;
    cost: string;
    pendingRequests: number;
  };
  daily?: unknown[];
}

export interface TimelineSnapshot {
  asOf: string;
  hits: SearchHit[];
}

export interface TimelineEntry {
  url: string;
  title: string;
  host: string;
  firstSeen: string;
  seenOn: string[];
}

export interface TimelineDiff {
  earlier: TimelineSnapshot;
  later: TimelineSnapshot;
  added: SearchHit[];
  persisted: SearchHit[];
  dropped: SearchHit[];
}
