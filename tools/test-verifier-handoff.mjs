import test from 'node:test';
import assert from 'node:assert/strict';
import { compileVerifierHandoff, renderVerifierHandoffMarkdown } from './compile-verifier-handoff.mjs';

const HEAD = '1111111111111111111111111111111111111111';
const BASE = '2222222222222222222222222222222222222222';
const MERGE = '3333333333333333333333333333333333333333';
const OTHER = '4444444444444444444444444444444444444444';

function event(overrides = {}) {
  return {
    pull_request: {
      number: 94,
      html_url: 'https://github.com/jordan-thirkle/ai-game-development-pipeline/pull/94',
      head: { ref: 'pipeline/example', sha: HEAD },
      base: { ref: 'main', sha: BASE },
      merge_commit_sha: MERGE,
      ...overrides,
    },
  };
}

function env(checkoutSha = HEAD, triggerSha = MERGE) {
  return {
    GITHUB_SHA: triggerSha,
    VERIFIER_CHECKOUT_SHA: checkoutSha,
    GITHUB_REPOSITORY: 'jordan-thirkle/ai-game-development-pipeline',
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_WORKFLOW: 'Verifier handoff',
    GITHUB_ACTOR: 'github-actions[bot]',
  };
}

const NOW = new Date('2026-08-20T00:30:00.000Z');

test('classifies exact candidate-head checkout even when pull_request trigger SHA is synthetic merge', () => {
  const handoff = compileVerifierHandoff({ event: event(), env: env(HEAD, MERGE), now: NOW });
  assert.equal(handoff.workflow_run.trigger_sha, MERGE);
  assert.equal(handoff.workflow_run.checkout_sha, HEAD);
  assert.equal(handoff.workflow_run.checkout_kind, 'candidate-head');
  assert.equal(handoff.evidence_boundary.candidate_head_proven, true);
  assert.equal(handoff.evidence_boundary.merge_revision_proven, false);
  assert.equal(handoff.evidence_boundary.revision_proven_by_this_run, HEAD);
});

test('classifies an actual synthetic merge checkout separately from candidate head', () => {
  const handoff = compileVerifierHandoff({ event: event(), env: env(MERGE, MERGE), now: NOW });
  assert.equal(handoff.workflow_run.checkout_kind, 'github-merge-revision');
  assert.equal(handoff.evidence_boundary.candidate_head_proven, false);
  assert.equal(handoff.evidence_boundary.merge_revision_proven, true);
  assert.match(handoff.evidence_boundary.note, /not the candidate head/);
});

test('fails closed when actual checkout matches neither event head nor merge revision', () => {
  const handoff = compileVerifierHandoff({ event: event(), env: env(OTHER, MERGE), now: NOW });
  assert.equal(handoff.workflow_run.checkout_kind, 'other-revision');
  assert.equal(handoff.evidence_boundary.candidate_head_proven, false);
  assert.equal(handoff.evidence_boundary.merge_revision_proven, false);
  assert.match(handoff.evidence_boundary.note, /matches neither/);
});

test('treats absent merge SHA as unknown rather than merge evidence', () => {
  const handoff = compileVerifierHandoff({
    event: event({ merge_commit_sha: null }),
    env: env(OTHER, OTHER),
    now: NOW,
  });
  assert.equal(handoff.pull_request.merge_commit_sha, null);
  assert.equal(handoff.workflow_run.checkout_kind, 'other-revision');
});

test('rejects non-pull-request events', () => {
  assert.throws(
    () => compileVerifierHandoff({ event: {}, env: env(), now: NOW }),
    /pull_request event payload is required/,
  );
});

test('rejects malformed candidate SHA before producing evidence', () => {
  assert.throws(
    () => compileVerifierHandoff({ event: event({ head: { ref: 'bad', sha: 'deadbeef' } }), env: env(), now: NOW }),
    /pull_request.head.sha must be a 40-character lowercase Git SHA/,
  );
});

test('rejects malformed trigger SHA before producing evidence', () => {
  assert.throws(
    () => compileVerifierHandoff({ event: event(), env: env(HEAD, 'DEADBEEF'), now: NOW }),
    /GITHUB_SHA must be a 40-character lowercase Git SHA/,
  );
});

test('rejects malformed actual checkout SHA before producing evidence', () => {
  assert.throws(
    () => compileVerifierHandoff({ event: event(), env: env('DEADBEEF', MERGE), now: NOW }),
    /VERIFIER_CHECKOUT_SHA must be a 40-character lowercase Git SHA/,
  );
});

test('renders both trigger and checkout revisions with explicit evidence booleans', () => {
  const markdown = renderVerifierHandoffMarkdown(
    compileVerifierHandoff({ event: event(), env: env(HEAD, MERGE), now: NOW }),
  );
  assert.match(markdown, /Candidate head proven by this run: \*\*true\*\*/);
  assert.match(markdown, /Merge revision proven by this run: \*\*false\*\*/);
  assert.match(markdown, new RegExp(HEAD));
  assert.match(markdown, new RegExp(MERGE));
});
