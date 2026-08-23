# Three.js save-read failure correctness gate

This gate exercises the integrated Three.js/WebGPU alpha when browser persistence reads fail before startup.

It is intentionally proof-only: production source and shared contracts are read-only. Browser Storage API read failures are injected before production initialization and do not count as gameplay progress.

Pass criteria for each injected read failure:
- production reaches `runtime.ready=true` with clean default progression (`reward.count=0`, no upgrades, effective damage 34);
- normal keyboard movement remains usable and release drift stays <= 0.03 m;
- the normal production Save control still succeeds when writes remain available (`save.schema_version=1` and persisted schema 1);
- no uncaught page/console errors;
- no production-source mutation or gameplay mutation shortcut.

A green gate proves recovery from persistence-read failure only. It does not prove corrupted semantic save validation, HUMAN-TESTED status, device execution, or release readiness.
