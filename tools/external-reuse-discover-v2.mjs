#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { formatValidationErrors, loadCanonicalReuseRegistry, loadValidators, runExternalDiscoveryV2 } from './lib/external-discovery-v2.mjs';

const briefPath = process.argv[2];
const outputPath = process.argv[3] ?? '/tmp/external-discovery-queue-v2.json';
if (!briefPath) {
  console.error('Usage: node tools/external-reuse-discover-v2.mjs <brief.json> [output.json]');
  process.exit(2);
}

try {
  const brief = JSON.parse(await readFile(briefPath, 'utf8'));
  const validators = await loadValidators();
  if (!validators.brief(brief)) throw new Error(`brief validation failed: ${formatValidationErrors(validators.brief.errors)}`);
  const canonicalRecords = await loadCanonicalReuseRegistry();
  const result = await runExternalDiscoveryV2({ brief, canonicalRecords, token: process.env.GITHUB_TOKEN ?? '' });
  if (!validators.queue(result)) throw new Error(`queue validation failed: ${formatValidationErrors(validators.queue.errors)}`);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`External discovery v2 wrote ${result.candidate_count} candidate(s) to ${outputPath}; new discoveries remain reviewer-controlled.`);
} catch (error) {
  console.error(`External discovery v2 failed: ${error.message}`);
  process.exit(1);
}
