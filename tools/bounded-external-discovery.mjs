import { readFile, writeFile } from 'node:fs/promises';
import {
  formatValidationErrors,
  loadDiscoveryValidators,
  runExternalDiscovery,
} from './lib/external-discovery.mjs';

const outputPath = process.argv[2] ?? '/tmp/bounded-discovery-result.json';
const registryPath = process.argv[3] ?? 'registry/open-source-game-reuse.v1.json';
const briefPath = 'examples/creator-mode/external-discovery-brief-001.json';

const [brief, registry, validators] = await Promise.all([
  readFile(briefPath, 'utf8').then(JSON.parse),
  readFile(registryPath, 'utf8').then(JSON.parse),
  loadDiscoveryValidators(),
]);

if (!validators.brief(brief)) {
  throw new Error(`Frozen discovery brief failed schema validation: ${formatValidationErrors(validators.brief.errors)}`);
}

const queue = await runExternalDiscovery({
  brief,
  registry,
  token: process.env.GITHUB_TOKEN ?? '',
});

if (!validators.queue(queue)) {
  throw new Error(`Reusable discovery queue failed schema validation: ${formatValidationErrors(validators.queue.errors)}`);
}

// PR #130's frozen comparison contract predates the reusable queue contract.
// Keep its exact public shape stable while proving both paths use the same engine.
const {
  schema_version: _schemaVersion,
  brief_id: _briefId,
  gaps: _gaps,
  ...comparisonResult
} = queue;

await writeFile(outputPath, `${JSON.stringify(comparisonResult, null, 2)}\n`);
console.log(JSON.stringify({
  search_actions: comparisonResult.search_actions,
  source_fetches: comparisonResult.source_fetches,
  total_network_actions: comparisonResult.search_actions + comparisonResult.source_fetches,
  search_hits_seen: comparisonResult.search_hits_seen,
  rejected_search_hits: comparisonResult.rejected_search_hits,
  candidates: comparisonResult.candidate_count,
  coverage_pct: comparisonResult.capability_candidate_coverage_pct,
  fully_cleared_coverage_pct: comparisonResult.fully_cleared_capability_coverage_pct,
  duplicates_filtered: comparisonResult.duplicate_selections_filtered,
  elapsed_minutes: comparisonResult.elapsed_minutes,
}, null, 2));
