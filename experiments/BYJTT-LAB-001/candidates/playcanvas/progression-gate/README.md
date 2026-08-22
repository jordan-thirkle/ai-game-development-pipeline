# PlayCanvas progression gate

Bounded BYJTT-LAB-001 steps 07–09 proof for PlayCanvas 2.21.3.

This gate preserves the shared player/salvage/progression constants and drives movement, attack, and upgrade interaction through normal browser keyboard events. Evidence is observation-only: there is no proof-harness position, salvage-health, reward, or upgrade mutation API.

The dependency graph is fail-closed: CI first materializes `package-lock.json`, verifies its SHA-256 against `expected-package-lock.sha256`, and only then executes `npm ci`.

Evidence boundary: rendered browser progression feasibility only. Native Ammo integration, Recast chase/combat, persistence/restart, unified Phase A, production assets, device profiling, and human playability are not claimed here.
