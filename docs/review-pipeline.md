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

## Price data case

### Source and flow

The primary source for this first pass is the City of Helsinki Service Map. `tools/import-service-map.mjs` fetches Helsinki units (`arealcity=91`), keeps units linked to LIPAS sports sites, and reads each unit's `PRICE` connection in Finnish and English. The snapshot stores the source unit ID, LIPAS link, source page URL, source text, and source update time in `src/data/service-map-helsinki.json`.

`tools/build-review-staging.mjs` turns source price text into review candidates. A reviewer checks the extracted options against the source page, then accepts, edits, rejects, or skips them in `/?review=1`. Decisions stay in that browser's local storage. Accepted records can be downloaded as JSON, but they are not yet written back to the map or a shared database. The current staging parser reads `priceEn`; the Finnish text is retained in the source snapshot but is not yet used as a fallback by the queue.

### Cases the reviewer must keep distinct

- **Explicitly free:** show free only when the source says entry is free. Keep any eligibility limits, such as age or customer group.
- **One published price:** preserve what the price applies to (for example, a single visit) and the source update date.
- **Several tariffs:** keep each product and audience together, such as adult, child, concession, or multi-visit prices. Do not imply that one tariff applies to everyone.
- **Conditional or restricted price:** preserve conditions such as weekday access, age limits, or proof of eligibility with that option.
- **Add-ons:** distinguish equipment or service charges (for example, a towel or personal customer card) from admission. They must not become the headline entry price.
- **No price in the source:** leave the price unknown. Missing data does not mean free, and a price from another facility must not be copied over.
- **Conflicting, stale, or unclear evidence:** leave it for review and retain both the source text and link. Use another source only when it is an official facility or operator source, and record that source explicitly.

The compact map card can show one clearly identified representative price when one exists; the venue detail should retain the relevant tariffs, audiences, conditions, and source. If there is no unambiguous representative price, show that the price is unknown or needs checking instead of guessing.

### Update cadence and displayed date

For the MVP, refresh the Helsinki Service Map snapshot monthly, and refresh sooner when the City announces a tariff change or a user reports an outdated price. This is a source-change check, not a request to reread every unchanged tariff each month. The current pipeline is manual; run `npm run data:service-map` and `npm run data:review-staging` to fetch and stage a new snapshot.

Keep the two dates distinct:

- `sourceUpdatedAt` is when the source record says it was changed.
- `review.reviewedAt` is when a person last checked and approved the displayed price.

The public label should use the second date, for example **“Price checked 7 Sep 2026”** / **“Hinta tarkistettu 7.9.2026”**, with a link to the official source. Do not label a source update or a data import as a human check. If the source price text changes, the prior approval must become stale and the changed candidate must return to review; unchanged text can keep its previous checked date. The local prototype does not yet detect stale approvals automatically, so this rule needs to be implemented before an approved export is treated as current map data.

### Current limitations

The queue is a review prototype, not yet a publishing workflow. It currently stages records that have a Helsinki Service Map price connection, extracts from English text only, and exports accepted results as a local JSON handoff. The parser is rule-based, so reviewers must check that a detected number is an admission tariff rather than an add-on and that it is attached to the right product and audience. No price should appear as verified map data until an approved export is deliberately integrated into the map dataset.
