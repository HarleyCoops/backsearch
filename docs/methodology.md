# Point-in-time methodology

## The three clocks

Every scenario should name three different dates:

1. **Event time** — when the underlying event or transaction occurred.
2. **Release time** — when a regulator, exchange, company, or provider made the datum public.
3. **Archive time** — when BackSearch captured a page and made it admissible at a cutoff.

Never substitute event time for release time. A congressional transaction, quarter-end financial fact, or drug issue can predate its disclosure by days or months.

## Safe joins

For a cutoff `T`, include a structured record only when its release time is at or before `T`. Include an article only when its `crawl_date` is at or before `T`.

```text
record_is_admissible = record.release_time <= T
page_is_admissible   = page.crawl_date <= end_of_day(T)
```

When the source does not expose a release timestamp, narrow the claim. Do not silently use an event date as an availability proxy.

## Revisions

Frozen web pages are reproducible, but many structured datasets are revised. A current API query for an old observation can return the latest vintage rather than the vintage available on that date.

Label each source:

- `vintage-safe`: the provider preserves historical releases or immutable records;
- `observation-only`: old dates are available, but later revisions may be reflected;
- `unknown`: revision behavior has not been established.

BackSearch can help recover contemporaneous release pages, but it does not turn a revised structured series into a vintage-safe series.

## Result interpretation

These scenarios compare information states. They do not establish:

- causation between a signal and a later outcome;
- trading intent from positions or options flow;
- medical causation from FDA adverse-event data;
- illegality from a disclosed trade;
- correctness of a prediction-market price.

The defensible output is a timestamped evidence ledger plus a clearly labeled inference.
