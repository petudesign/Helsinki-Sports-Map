# Security model

The public map and the reviewer/admin system are separate trust zones.

## Trust zones

```text
External APIs / HTML / PDF / OCR / AI output
                    ↓
              raw + proposed
                    ↓
          validation + human review
                    ↓
              approved dataset
                    ↓
                public read API
```

External content is data, never instructions. A document must not be able to change the reviewer's permissions, the agent's task, or which tools are available.

## Required backend rules

- Public clients may read approved records only.
- Review, edit, sync, extraction, source configuration, and audit endpoints require authentication and authorization.
- Source URLs come from an allowlisted source registry; there is no arbitrary public `POST /scrape { url }` endpoint.
- Fetchers enforce HTTPS where possible, allowed hosts, redirects, content type, response size, page count, and timeouts.
- Secrets stay in server-side environment variables and are never shipped in the client bundle or committed to Git.
- Sync jobs are idempotent, rate-limited, observable, and safe to retry.
- A failed or suspicious run never deletes the last approved dataset.
- Every approved fact stores provenance: source URL, document hash, fetched time, evidence location, parser version, confidence, and approval state.
- Accessibility claims are presented as source-backed facts with an update date, not as an unconditional safety guarantee.
- Review audit logs are append-only and contain the minimum personal data needed for accountability.

## Public repository rule

The repository may be public, but it must contain only source code, public fixtures, schemas, and documentation. It must not contain API keys, service-role keys, cron secrets, personal review data, private source documents, or private infrastructure identifiers.

## Public lookup endpoints

- Public lookup functions accept only GET requests and a small, validated query shape.
- Provider requests use fixed result-size limits, timeouts, response-size limits, and provider-specific rate controls.
- Address suggestions use the Helsinki street index first; credentialed address resolution happens only for a selected or submitted address.
- User-derived route and reverse-geocoding responses are private and are not CDN-cached.
- Production Vercel WAF adds a cross-instance limit of 100 requests per client IP per 60 seconds for paths beginning with `/api/`. Endpoint-specific application limits remain stricter where needed.

