import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:4173/apps/studio/';
const artifacts = process.env.BROWSER_ARTIFACTS || 'artifacts/control-plane-browser';
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));

  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Studio failed to load: HTTP ${response?.status()}`);
  await page.waitForFunction(() => document.querySelector('#name')?.textContent !== 'Loading…');
  await page.locator('[data-view="local-run"]').click();
  await page.locator('#run-sample').click();
  await page.waitForFunction(() => document.querySelector('#run-message')?.textContent.includes('Release candidate ready'), null, { timeout: 30000 });

  const envelope = await page.evaluate(async () => {
    const latest = await fetch('/api/pipeline/runs/latest', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!latest.ok) throw new Error(`latest-run fetch failed: ${latest.status}`);
    return latest.json();
  });
  assert.equal(envelope.available, true);
  const releaseCandidate = envelope.run?.evidence?.releaseCandidate;
  const publishing = envelope.run?.evidence?.publishing;
  assert.equal(releaseCandidate?.dryRunOnly, true);
  assert.equal(typeof releaseCandidate?.candidateId, 'string');
  assert(releaseCandidate.candidateId.length > 0);
  assert.equal(typeof releaseCandidate?.build?.artifactPath, 'string');
  assert(releaseCandidate.build.artifactPath.length > 0);
  assert.match(releaseCandidate.build.outputSha256, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(releaseCandidate.destination, publishing.destination);
  assert.equal(publishing?.executed, false);
  assert.equal(publishing?.dryRun, true);
  assert.equal(publishing?.provider, null);
  assert.equal(publishing?.storeOperation, null);
  assert.equal(publishing?.secretsUsed, false);
  assert.equal(publishing?.destination?.kind, 'local');
  assert.deepEqual(publishing?.plan, [`Would publish release-candidate.json to ${publishing.destination.target}`]);

  await page.waitForFunction(
    ({ candidateId, plan }) => {
      const text = document.querySelector('[data-inline-verification="true"]')?.textContent || '';
      return text.includes(candidateId) && text.includes(plan);
    },
    { candidateId: releaseCandidate.candidateId, plan: publishing.plan[0] },
    { timeout: 10000 }
  );
  const summary = await page.locator('[data-inline-verification="true"]').textContent();
  assert.match(summary, /Verification summary/);
  assert(summary.includes(`Release candidate ID: ${releaseCandidate.candidateId}`), 'release candidate ID was not visible in Studio');
  assert(summary.includes(`Release candidate artifact: ${releaseCandidate.build.artifactPath}`), 'release artifact path was not visible in Studio');
  assert(summary.includes(`Release destination: ${publishing.destination.target}`), 'release destination was not visible in Studio');
  assert(summary.includes(`Release candidate SHA-256: ${releaseCandidate.build.outputSha256}`), 'release candidate digest was not visible in Studio');
  assert.match(summary, /Release candidate provenance: explicit identity \+ destination/);
  assert(summary.includes(`Publishing plan: ${publishing.plan[0]}`), 'exact dry-run publishing plan was not visible in Studio');
  assert.match(summary, /Publishing authority: none/);
  assert.match(summary, /separately authorized credentialed execution evidence/);
  assert.match(summary, /Publication: not executed/);
  assert.match(summary, /Secrets: not used/);
  assert(summary.includes(`Destination: ${publishing.destination.target}`), 'local destination was not visible in Studio');
  assert.deepEqual(consoleErrors, []);

  await page.screenshot({ path: resolve(artifacts, 'studio-inline-release-candidate.png'), fullPage: true });
  console.log(`Studio inline release-candidate browser dogfood passed: ${JSON.stringify({ candidateId: releaseCandidate.candidateId, artifactPath: releaseCandidate.build.artifactPath, candidateSha256: releaseCandidate.build.outputSha256, publicationExecuted: publishing.executed, dryRun: publishing.dryRun, destination: publishing.destination, plan: publishing.plan })}`);
  await page.close();
} finally {
  await browser.close();
}
