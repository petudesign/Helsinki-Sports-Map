# Translation workflow

The translation handoff file is `catalog.csv`. A translator does not need to open the application source code.

1. Fill only the `zh-Hans` column.
2. Keep every `key` unchanged.
3. Preserve placeholders such as `{city}` exactly.
4. Use the `context` and `notes` columns when choosing wording.
5. Keep product and place names recognizable: Helsinki, Töölö, Olympiastadion, LIPAS and OpenStreetMap are not ordinary words to translate.
6. Review the completed translations in the running UI before release. Short buttons and narrow mobile layouts need special attention.

The first Chinese locale should be Simplified Chinese (`zh-Hans`). The CSV is intentionally human-editable; the application’s runtime locale files can be generated from this catalog once the English and Finnish copy is stable.
