#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { formatValidationErrors, loadDiscoveryValidators, runExternalDiscovery } from './lib/external-discovery.mjs';

const briefPath = process.argv[2];
const outputPath = process.argv[3] ?? '/tmp/external-discovery-queue.json';
const registryPath = process.argv[4] ?? 'registry/open-source-game-reuse.v1.json';

if (!briefPath) {
  console.error('Usage: node tools/external-reuse-discover.mjs <brief.json> [output.json] [registry.json]');
  process.exit(2);
}

try {
  const [brief, registry, validators] = await Promise.all([
    readFile(briefPath, 'utf8').then(JSON.parse),
    readFile(registryPath, 'utf8').then(JSON.parse),
    loadDiscoveryValidators(),
  ]);

  if (!validators.brief(brief)) {
    throw new Error(`Discovery brief failed schema validation: ${formatValidationErrors(validators.brief.errors)}`);
  }

  const queue = await runExternalDiscovery({
    brief,
    registry,
    token: process.env.GITHUB_TOKEN ?? '',
  });

  if (!validators.queue(queue)) {
    throw new Error(`Discovery queue failed schema validation: ${formatValidationErrors(validators.queue.errors)}`);
  }

  await writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`);
  console.log(JSON.stringify({
    brief_id: queue.brief_id,
    output: outputPath,
    search_actions: queue.search_actions,
    source_fetches: queue.source_fetches,
    total_network_actions: queue.search_actions + queue.source_fetches,
    candidates: queue.candidate_count,
    coverage_pct: queue.capability_candidate_coverage_pct,
    fully_cleared_coverage_pct: queue.fully_cleared_capability_coverage_pct,
    gaps: queue.gaps,
    unsafe_promotions: queue.unsafe_promotions,
    elapsed_minutes: queue.elapsed_minutes,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
