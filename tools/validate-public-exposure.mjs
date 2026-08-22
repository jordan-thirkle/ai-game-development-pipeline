#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const failures = [];
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const forbiddenPathRules = [
  { re: /(^|\/)\.env(?:\.|$)/, allow: /(^|\/)\.env\.example$/ },
  { re: /(^|\/)(?:\.npmrc|\.pypirc|\.netrc)$/ },
  { re: /(^|\/)(?:credentials(?:\.[^/]+)?\.json|service[-_]account[^/]*\.json|client_secret[^/]*\.json)$/i },
  { re: /(^|\/)(?:id_rsa|id_ed25519)(?:\.[^/]*)?$/ },
  { re: /(^|\/)(?:\.vercel|\.netlify|\.firebase|\.wrangler|\.direnv)(?:\/|$)/ },
  { re: /(^|\/)terraform\.tfstate(?:\.|$)/ },
];

for (const path of tracked) {
  for (const rule of forbiddenPathRules) {
    if (rule.re.test(path) && !(rule.allow?.test(path))) {
      failures.push(`${path}: tracked path is local/private by policy`);
    }
  }
}

const secretPatterns = [
  ['PEM private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub classic token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['Stripe live secret', /\bsk_live_[0-9A-Za-z]{20,}\b/],
];

for (const path of tracked) {
  let content;
  try {
    content = await readFile(path, 'utf8');
  } catch {
    continue;
  }
  if (content.includes('\u0000')) continue;
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(content)) failures.push(`${path}: matches high-confidence ${label} pattern`);
  }
}

if (failures.length) {
  console.error('Public repository exposure validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public repository exposure validation passed (${tracked.length} tracked paths scanned).`);
