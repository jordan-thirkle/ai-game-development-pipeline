#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const patterns = [
  ['PEM private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['GitHub classic token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['Stripe live secret', /\bsk_live_[0-9A-Za-z]{20,}\b/g],
];

let history;
try {
  history = execFileSync(
    'git',
    ['log', '--all', '--format=commit:%H', '--patch', '--no-ext-diff', '--binary', '--unified=0'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  );
} catch (error) {
  console.error(`Unable to scan git history: ${error.message}`);
  process.exit(2);
}

const findings = [];
for (const [label, pattern] of patterns) {
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(history)) !== null) {
    const before = history.slice(0, match.index);
    const commit = before.match(/commit:([0-9a-f]{40})(?![\s\S]*commit:)/)?.[1] ?? '<unknown>';
    findings.push(`${label} pattern found in git history near commit ${commit}`);
    if (findings.length >= 20) break;
  }
  if (findings.length >= 20) break;
}

if (findings.length) {
  console.error('Git history secret scan failed. Treat every matching credential as compromised and rotate it before rewriting history:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Git history secret scan passed for configured high-confidence credential patterns.');
