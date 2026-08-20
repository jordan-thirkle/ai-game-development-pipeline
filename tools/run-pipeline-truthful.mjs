#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = resolve(HERE, 'run-pipeline.mjs');

const UNMEASURED_EXECUTION_FIELDS = [
  'toolCalls',
  'failedToolCalls',
  'humanInterventions',
  'humanMinutes',
  'iterations',
  'bespokeLinesChanged'
];

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

export function normalizeUnmeasuredTelemetry(record) {
  if (!record || typeof record !== 'object' || !record.execution || typeof record.execution !== 'object') {
    throw new Error('pipeline-run record has no execution object');
  }
  const normalized = structuredClone(record);
  for (const field of UNMEASURED_EXECUTION_FIELDS) normalized.execution[field] = null;
  return normalized;
}

export async function normalizePipelineRunFile(outputDir) {
  const path = resolve(outputDir, 'pipeline-run.json');
  let record;
  try {
    record = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  await writeFile(path, `${JSON.stringify(normalizeUnmeasuredTelemetry(record), null, 2)}\n`, 'utf8');
  return true;
}

async function runChild(args) {
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [RUNNER, ...args], { stdio: 'inherit', shell: false });
    child.once('error', rejectChild);
    child.once('close', (code, signal) => resolveChild({ code: code ?? 1, signal }));
  });
}

export async function main(args = process.argv.slice(2)) {
  const output = optionValue(args, '--output');
  if (!output) {
    console.error('USAGE: truthful local pipeline requires an explicit --output directory');
    return 2;
  }

  const result = await runChild(args);
  const normalized = await normalizePipelineRunFile(output);
  if (normalized) {
    console.log('Truthfulness gate: unmeasured execution telemetry is recorded as null, not fabricated zeroes.');
  }
  if (result.signal) console.error(`Pipeline child exited via signal ${result.signal}`);
  return result.code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(`TRUTHFUL_PIPELINE_ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
