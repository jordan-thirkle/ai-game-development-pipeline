import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVerificationPage, releaseCandidateProjection } from './studio-verification-page.mjs';

function safeEvidence(destinationTarget = 'local://release-candidate') {
  const digest = `sha256:${'a'.repeat(64)}`;
  return {
    build: { executed: true, status: 'pass', artifactSha256: digest },
    qa: { executed: true, status: 'pass', artifactSha256: digest },
    releaseCandidate: {
      candidateId: 'sample-game-local-rc',
      dryRunOnly: true,
      destination: { kind: 'local', target: destinationTarget },
      build: { artifactPath: 'dist', outputSha256: digest }
    },
    publishing: { executed: false, secretsUsed: false },
    destination: { kind: 'local' },
    destinationTarget
  };
}

test('renders concrete release candidate facts using only local, scriptless controls', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const html = createVerificationPage(safeEvidence(), digest).toString('utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /starter\/dist\/index\.html/);
  assert.match(html, /VERIFICATION\.txt/);
  assert.match(html, /Release candidate ID/);
  assert.match(html, /sample-game-local-rc/);
  assert.match(html, /Candidate artifact/);
  assert.match(html, />dist</);
  assert.match(html, /Candidate destination/);
  assert.match(html, /local:\/\/release-candidate/);
  assert.match(html, /dry-run only/);
  assert.match(html, new RegExp(digest));
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /javascript:/i);
});

test('escapes candidate evidence text instead of turning it into executable markup', () => {
  const payload = 'local://release-candidate/<script>globalThis.pwned=true</script><img src=x onerror=alert(1)>';
  const html = createVerificationPage(safeEvidence(payload), `sha256:${'b'.repeat(64)}`).toString('utf8');
  assert.doesNotMatch(html, /<script>globalThis\.pwned/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;globalThis\.pwned=true&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('fails closed when release candidate destination contradicts verified safety destination', () => {
  const evidence = safeEvidence('local://release-candidate');
  evidence.releaseCandidate.destination = { kind: 'local', target: 'local://different-candidate' };
  assert.throws(() => releaseCandidateProjection(evidence), /incomplete or contradicts/);

  evidence.releaseCandidate.destination = { kind: 'remote', target: 'https://example.invalid/release' };
  assert.throws(() => releaseCandidateProjection(evidence), /incomplete or contradicts/);
});

test('fails closed on missing identity, non-dry-run state, unsafe artifact metadata, or malformed digest', () => {
  for (const mutate of [
    (evidence) => { evidence.releaseCandidate.candidateId = ''; },
    (evidence) => { evidence.releaseCandidate.candidateId = 'bad\nidentity'; },
    (evidence) => { evidence.releaseCandidate.dryRunOnly = false; },
    (evidence) => { evidence.releaseCandidate.build.artifactPath = 'dist\nunsafe'; },
    (evidence) => { evidence.releaseCandidate.build.outputSha256 = 'sha256:not-a-digest'; }
  ]) {
    const evidence = safeEvidence();
    mutate(evidence);
    assert.throws(() => releaseCandidateProjection(evidence), /incomplete or contradicts/);
  }
});
