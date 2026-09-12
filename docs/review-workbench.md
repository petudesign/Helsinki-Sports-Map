# Reviewer workbench

The reviewer workbench is a local-only prototype for validating extracted sports venue facts before they become canonical map data.

Open it locally with `?review=1`.

## Current boundary

- The prototype reads only the public Helsinki Service Map snapshot already shipped with the app.
- Decisions are stored in this browser's `localStorage` under a versioned key.
- The prototype cannot write to the map dataset, trigger sync jobs, change source configuration, or access secrets.
- This is not an admin system yet. Authentication, authorization, server-side persistence, and audit logging belong to the backend implementation.

## Review contract

Each candidate must show:

- the proposed primary value and all structured price options found in the source
- the original source evidence
- the source URL and update timestamp
- validation checks and unresolved checks
- a clear action: accept, edit, reject, or skip

When a candidate contains several prices, `Accept` approves the complete detected price-option set together. The primary option is the compact card value; the remaining options stay available in the detailed venue view. `Edit` currently changes only the primary option and keeps the other detected options intact.

The prototype shows a rule-based evidence score as a percentage. It is deliberately not presented as a probability: each deterministic check has a visible weight, passed checks add their points, and unresolved checks hold their points back. The current weights are price format 35, venue match 30, source freshness 20, and cross-source verification 15. A record reaches 100% only when every check passes.

The next backend version should persist the decision together with the source document hash, parser version, evidence location, reviewer identity, and timestamp.

## Safety invariant

Raw and proposed extraction output must never be used as public canonical data. A future pipeline must publish only validated records and keep the last accepted dataset when an extraction run fails or a source layout changes.
