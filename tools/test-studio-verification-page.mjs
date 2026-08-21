import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVerificationPage } from './studio-verification-page.mjs';

function safeEvidence(destinationTarget = 'local://release-candidate') {
  const digest = `sha256:${'a'.repeat(64)}`;
  return {
    build: { executed: true, status: 'pass', artifactSha256: digest },
    qa: { executed: true, status: 'pass', artifactSha256: digest },
    releaseCandidate: { dryRunOnly: true, build: { outputSha256: digest } },
    publishing: { executed: false, secretsUsed: false },
    destination: { kind: 'local' },
    destinationTarget
  };
}

test('renders only local, scriptless verification controls', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const html = createVerificationPage(safeEvidence(), digest).toString('utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /starter\/dist\/index\.html/);
  assert.match(html, /VERIFICATION\.txt/);
  assert.match(html, new RegExp(digest));
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /javascript:/i);
});

test('escapes evidence text instead of turning it into executable markup', () => {
  const payload = 'local://release-candidate/<script>globalThis.pwned=true</script><img src=x onerror=alert(1)>';
  const html = createVerificationPage(safeEvidence(payload), `sha256:${'b'.repeat(64)}`).toString('utf8');
  assert.doesNotMatch(html, /<script>globalThis\.pwned/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;globalThis\.pwned=true&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
