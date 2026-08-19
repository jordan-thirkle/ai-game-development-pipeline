# Domain Context Contract

The root `CONTEXT.md` is the canonical low-resolution description of the pipeline domain once introduced. Architectural decisions belong under `docs/adr/`. Detailed operational contracts remain in their focused docs and schemas.

Do not use chat history as canonical domain documentation.

A worker should load only the smallest relevant context slice: root operating contract, current work unit, affected domain docs/schemas, and fresh repository evidence. Full-history context dumps are a fallback, not the default.