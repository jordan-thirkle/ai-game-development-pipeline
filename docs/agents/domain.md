# Domain Context Contract

The root [`CONTEXT.md`](../../CONTEXT.md) is the canonical low-resolution description of the pipeline domain. Architectural decisions belong under `docs/adr/` as they are introduced. Detailed operational contracts remain in their focused docs and schemas.

Do not use chat history as canonical domain documentation.

A worker should load only the smallest relevant context slice: root operating contract, current work unit, affected domain docs/schemas, and fresh repository evidence. Full-history context dumps are a fallback, not the default.