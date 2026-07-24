# Security

## Supported versions

This project is pre-1.0. Security fixes are applied to the latest `main` branch.

## Secrets

Never commit `.env`, provider API keys, portal access tokens, or captured provider responses containing account metadata.

The default server binds to `127.0.0.1`. If you intentionally change `HOST`, configure `BACKSEARCH_ACCESS_TOKEN`, an allowed origin, TLS at the edge, and an external rate limit.

The browser must never receive `OPENREWARD_API_KEY`, `OPENAI_API_KEY`, or `UW_API_KEY`.

## Reports

Open a private GitHub security advisory for vulnerabilities. Do not include active credentials, funded account identifiers, or provider response data in a public issue.
