# Contributing

Contributions should preserve the central invariant: no result may cross its declared evidence cutoff.

Before opening a pull request:

```bash
npm install
npm run check
```

For a new data source, document:

- its public endpoint and official documentation;
- authentication and redistribution constraints;
- event, release, and revision semantics;
- the exact field used as the evidence clock;
- whether the endpoint returns the historical vintage or today's revised view.

Do not commit third-party response fixtures unless their license clearly permits redistribution.
