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

- the proposed normalized value
- the original source evidence
- the source URL and update timestamp
- validation checks and unresolved checks
- a clear action: accept, edit, reject, or skip

The next backend version should persist the decision together with the source document hash, parser version, evidence location, reviewer identity, and timestamp.

## Safety invariant

Raw and proposed extraction output must never be used as public canonical data. A future pipeline must publish only validated records and keep the last accepted dataset when an extraction run fails or a source layout changes.

