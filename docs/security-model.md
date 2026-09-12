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

