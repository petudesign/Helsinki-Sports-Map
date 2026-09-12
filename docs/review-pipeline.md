# Review pipeline

The first data pipeline is intentionally local and zero-cost:

```text
public source snapshot → review staging → local reviewer → approved JSON export
```

## Commands

- `npm run data:service-map` refreshes the public Helsinki Service Map snapshot.
- `npm run data:review-staging` converts the snapshot into `src/data/review-staging.json`.
- `npm run check:review-staging` validates the staging schema, provenance, price options, and 100-point check weights.
- Open `/?review=1` to review candidates.
- `Export N approved` downloads the accepted records as a versioned JSON file.

The staging builder is a deterministic local transformation. It does not call an AI service, use OCR, or require credentials. A future city can run the same builder with a different source snapshot and city argument, provided the source adapter produces the same staging contract.

## Trust boundaries

- Raw source data remains evidence and is not public canonical data.
- Staging candidates are proposals and can contain parser mistakes.
- The reviewer decision is stored locally in browser `localStorage` for this prototype.
- The approved export is a handoff artifact, not yet a production API or database write.

Each approved record keeps the structured prices together with source URL, source timestamp, source text, extractor version, reviewer note, and review timestamp. This is the minimum provenance needed before a backend persistence layer is introduced.

## Current scope

The first adapter covers price text from the Helsinki Service Map snapshot. Accessibility, family signals, opening hours, and PDF/OCR inputs should reuse the same staging/review contract rather than create separate reviewer workflows.
