import assert from 'node:assert/strict';
import test from 'node:test';
import { createStarterHomePage } from './studio-starter-home-page.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const otherHash = `sha256:${'b'.repeat(64)}`;
const manifest = {
  name: 'Harbour Run',
  objective: 'A small verified local starter.',
  starter: {
    mechanic: 'collect',
    requestedTargetPlatform: 'mobile',
    executedTargetPlatform: 'web'
  }
};

function evidence(overrides = {}) {
  const base = {
    build: { executed: true, status: 'pass', artifactSha256: hash },
    qa: { executed: true, status: 'pass', artifactSha256: hash },
    releaseCandidate: {
      candidateId: 'harbour-run-run-123',
      dryRunOnly: true,
      build: { artifactPath: 'dist', outputSha256: hash },
      destination: { kind: 'local', target: 'local://planned/harbour-run' }
    },
    publishing: {
      dryRun: true,
      executed: false,
      provider: null,
      storeOperation: null,
      secretsUsed: false,
      releaseCandidatePath: 'release-candidate.json',
      destination: { kind: 'local', target: 'local://planned/harbour-run' },
      plan: ['Would publish release-candidate.json to local://planned/harbour-run']
    },
    destination: { kind: 'local', target: 'local://planned/harbour-run' },
    destinationTarget: 'local://planned/harbour-run'
  };
  return { ...base, ...overrides };
}

function htmlFor(value, bundledHash = hash) {
  return createStarterHomePage(manifest, value, bundledHash).toString('utf8');
}

test('starter home surfaces exact QA artifact binding without raw evidence inspection', () => {
  const html = htmlFor(evidence());
  assert.match(html, /aria-label="QA artifact proof"/);
  assert.match(html, /The same bytes passed build, QA, and promotion/);
  assert.match(html, /Build SHA-256/);
  assert.match(html, /QA SHA-256/);
  assert.match(html, /Promoted candidate SHA-256/);
  assert.match(html, new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /fails closed if those artifact identities disagree/);
});

test('legacy starter home remains renderable but does not invent missing build/QA artifact binding', () => {
  const value = evidence();
  delete value.build.artifactSha256;
  delete value.qa.artifactSha256;
  const html = htmlFor(value);
  assert.match(html, /Artifact binding unavailable in legacy evidence/);
  assert.match(html, /No byte-identity proof is inferred/);
  assert.doesNotMatch(html, /The same bytes passed build, QA, and promotion/);
});

test('partially supplied current artifact proof fails closed instead of falling back to legacy', () => {
  const value = evidence();
  delete value.qa.artifactSha256;
  assert.throws(() => htmlFor(value), /matching build, QA, release-candidate, and packaged artifact SHA-256 evidence/);
});

test('starter home refuses build, QA, candidate, or packaged-artifact digest disagreement', () => {
  const buildMismatch = evidence();
  buildMismatch.build.artifactSha256 = otherHash;
  assert.throws(() => htmlFor(buildMismatch), /matching build, QA, release-candidate, and packaged artifact SHA-256 evidence/);

  const qaMismatch = evidence();
  qaMismatch.qa.artifactSha256 = otherHash;
  assert.throws(() => htmlFor(qaMismatch), /matching build, QA, release-candidate, and packaged artifact SHA-256 evidence/);

  const candidateMismatch = evidence();
  candidateMismatch.releaseCandidate.build.outputSha256 = otherHash;
  assert.throws(() => htmlFor(candidateMismatch), /matching build, QA, release-candidate, and packaged artifact SHA-256 evidence/);

  assert.throws(() => htmlFor(evidence(), otherHash), /matching build, QA, release-candidate, and packaged artifact SHA-256 evidence/);
});

test('starter home surfaces the exact truthful local release candidate', () => {
  const html = htmlFor(evidence());
  assert.match(html, /aria-label="Release candidate"/);
  assert.match(html, /harbour-run-run-123/);
  assert.match(html, /dry-run only/);
  assert.match(html, /<span>Artifact<\/span><b>dist<\/b>/);
  assert.match(html, /local:\/\/planned\/harbour-run/);
  assert.match(html, new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /does not grant publishing authority/);
});

test('legacy candidate identity and destination stay visibly unknown rather than inferred', () => {
  const value = evidence();
  delete value.releaseCandidate.candidateId;
  delete value.releaseCandidate.destination;
  const html = htmlFor(value);
  assert.match(html, /Candidate ID<\/span><b>unavailable in legacy evidence<\/b>/);
  assert.match(html, /Destination<\/span><b>unavailable in legacy evidence<\/b>/);
  assert.match(html, /remain unavailable rather than inferred/);
});

test('candidate HTML is escaped rather than executed', () => {
  const value = evidence();
  value.releaseCandidate.candidateId = '<img src=x onerror=alert(1)>';
  const html = htmlFor(value);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('remote candidate destination fails closed', () => {
  const value = evidence();
  value.releaseCandidate.destination = { kind: 'remote', target: 'https://example.com/release' };
  assert.throws(() => htmlFor(value), /Release candidate evidence is incomplete/);
});

test('mismatched local candidate destination fails closed', () => {
  const value = evidence();
  value.releaseCandidate.destination = { kind: 'local', target: 'local://planned/other' };
  assert.throws(() => htmlFor(value), /Release candidate evidence is incomplete/);
});

test('non-dry-run candidate fails closed', () => {
  const value = evidence();
  value.releaseCandidate.dryRunOnly = false;
  assert.throws(() => htmlFor(value), /validated local dry-run project and evidence state|Release candidate evidence is incomplete/);
});

test('malformed candidate provenance fails closed', () => {
  for (const mutate of [
    (value) => { value.releaseCandidate.candidateId = 'bad\u0000id'; },
    (value) => { value.releaseCandidate.build.artifactPath = 'dist\u0000bad'; },
    (value) => { value.releaseCandidate.build.outputSha256 = 'sha256:not-a-hash'; }
  ]) {
    const value = evidence();
    mutate(value);
    assert.throws(() => htmlFor(value), /matching build, QA, release-candidate, and packaged artifact SHA-256 evidence|validated local dry-run project and evidence state|Release candidate evidence is incomplete/);
  }
});
