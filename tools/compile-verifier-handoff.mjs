#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_RE = /^[0-9a-f]{40}$/;

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function requireSha(value, name) {
  const sha = requireString(value, name);
  if (!SHA_RE.test(sha)) throw new Error(`${name} must be a 40-character lowercase Git SHA`);
  return sha;
}

export function compileVerifierHandoff({ event, env, now = new Date() }) {
  if (!event?.pull_request) throw new Error('pull_request event payload is required');

  const pr = event.pull_request;
  const headSha = requireSha(pr.head?.sha, 'pull_request.head.sha');
  const baseSha = requireSha(pr.base?.sha, 'pull_request.base.sha');
  const triggerSha = requireSha(env.GITHUB_SHA, 'GITHUB_SHA');
  const checkoutSha = requireSha(env.VERIFIER_CHECKOUT_SHA, 'VERIFIER_CHECKOUT_SHA');
  const repository = requireString(env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
  const runId = requireString(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const runAttempt = requireString(env.GITHUB_RUN_ATTEMPT ?? '1', 'GITHUB_RUN_ATTEMPT');
  const workflow = requireString(env.GITHUB_WORKFLOW, 'GITHUB_WORKFLOW');
  const actor = requireString(env.GITHUB_ACTOR, 'GITHUB_ACTOR');

  const mergeCommitSha = typeof pr.merge_commit_sha === 'string' && SHA_RE.test(pr.merge_commit_sha)
    ? pr.merge_commit_sha
    : null;

  const checkoutKind = checkoutSha === headSha
    ? 'candidate-head'
    : checkoutSha === mergeCommitSha
      ? 'github-merge-revision'
      : 'other-revision';

  return {
    schema_version: 1,
    generated_at: now.toISOString(),
    repository,
    pull_request: {
      number: pr.number,
      url: pr.html_url,
      head: { ref: pr.head?.ref ?? null, sha: headSha },
      base: { ref: pr.base?.ref ?? null, sha: baseSha },
      merge_commit_sha: mergeCommitSha,
    },
    workflow_run: {
      workflow,
      run_id: runId,
      run_attempt: runAttempt,
      actor,
      trigger_sha: triggerSha,
      checkout_sha: checkoutSha,
      checkout_kind: checkoutKind,
      run_url: `https://github.com/${repository}/actions/runs/${runId}`,
    },
    evidence_boundary: {
      revision_proven_by_this_run: checkoutSha,
      candidate_head_proven: checkoutKind === 'candidate-head',
      merge_revision_proven: checkoutKind === 'github-merge-revision',
      note: checkoutKind === 'candidate-head'
        ? 'The actually checked-out revision equals the pull request candidate head. The GitHub trigger SHA is retained separately and may be a synthetic merge revision.'
        : checkoutKind === 'github-merge-revision'
          ? 'The actually checked-out revision is GitHub\'s synthetic pull-request merge revision, not the candidate head. Candidate-head execution requires a separate exact-head checkout/run.'
          : 'The actually checked-out revision matches neither the pull request head nor the event merge revision; do not attribute candidate-head or merge-revision execution without additional evidence.',
    },
  };
}

export function renderVerifierHandoffMarkdown(handoff) {
  const e = handoff.evidence_boundary;
  return [
    '# Verifier handoff',
    '',
    `- PR: #${handoff.pull_request.number}`,
    `- Candidate head: \`${handoff.pull_request.head.sha}\``,
    `- Base: \`${handoff.pull_request.base.sha}\``,
    `- GitHub trigger revision: \`${handoff.workflow_run.trigger_sha}\``,
    `- Checked-out revision: \`${handoff.workflow_run.checkout_sha}\``,
    `- Checkout classification: **${handoff.workflow_run.checkout_kind}**`,
    `- Candidate head proven by this run: **${e.candidate_head_proven}**`,
    `- Merge revision proven by this run: **${e.merge_revision_proven}**`,
    `- Run: ${handoff.workflow_run.run_url}`,
    '',
    `Evidence boundary: ${e.note}`,
    '',
  ].join('\n');
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required');
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const handoff = compileVerifierHandoff({ event, env: process.env });
  const outDir = process.env.VERIFIER_HANDOFF_DIR ?? 'verifier-handoff';
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'verifier-handoff.json'), `${JSON.stringify(handoff, null, 2)}\n`);
  const markdown = renderVerifierHandoffMarkdown(handoff);
  fs.writeFileSync(path.join(outDir, 'README.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(JSON.stringify(handoff));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`verifier handoff failed: ${error.message}`);
    process.exitCode = 1;
  });
}
