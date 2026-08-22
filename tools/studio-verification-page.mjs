function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fact(label, value, tone = 'neutral') {
  return `<div class="fact fact-${tone}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const LEGACY_UNKNOWN = 'unavailable in legacy evidence';

export function releaseCandidateProjection(evidence) {
  const candidate = evidence?.releaseCandidate;
  const safetyDestination = evidence?.destination;
  const destinationTarget = evidence?.destinationTarget;
  const suppliedCandidateId = candidate?.candidateId;
  const candidateDestination = candidate?.destination;
  const artifactPath = candidate?.build?.artifactPath;
  const outputSha256 = candidate?.build?.outputSha256;

  const candidateIdValid = suppliedCandidateId === undefined
    || (typeof suppliedCandidateId === 'string'
      && suppliedCandidateId.length > 0
      && suppliedCandidateId.length <= 160
      && !CONTROL_CHARACTER_PATTERN.test(suppliedCandidateId));
  const safetyDestinationValid = safetyDestination?.kind === 'local'
    && typeof destinationTarget === 'string'
    && destinationTarget.startsWith('local://');
  const candidateDestinationValid = candidateDestination === undefined
    || (candidateDestination?.kind === 'local'
      && candidateDestination?.target === destinationTarget);
  const artifactValid = typeof artifactPath === 'string'
    && artifactPath.length > 0
    && artifactPath.length <= 512
    && !CONTROL_CHARACTER_PATTERN.test(artifactPath);

  if (!candidateIdValid
    || candidate?.dryRunOnly !== true
    || !safetyDestinationValid
    || !candidateDestinationValid
    || !artifactValid
    || !SHA256_PATTERN.test(outputSha256 || '')) {
    throw new Error('Release candidate evidence is incomplete or contradicts the verified local dry-run boundary.');
  }

  return {
    candidateId: suppliedCandidateId ?? LEGACY_UNKNOWN,
    artifactPath,
    outputSha256,
    destinationTarget: candidateDestination === undefined ? LEGACY_UNKNOWN : destinationTarget,
    provenanceComplete: suppliedCandidateId !== undefined && candidateDestination !== undefined,
    dryRunOnly: true
  };
}

export function createVerificationPage(evidence, bundledArtifactSha256) {
  const { build, qa, publishing, destination, destinationTarget } = evidence;
  const releaseCandidate = releaseCandidateProjection(evidence);
  const facts = [
    fact('Build', `${build.status} · executed`, 'pass'),
    fact('QA', `${qa.status} · executed`, 'pass'),
    fact('Release candidate ID', releaseCandidate.candidateId, releaseCandidate.provenanceComplete ? 'safe' : 'neutral'),
    fact('Release candidate', 'dry-run only', 'safe'),
    fact('Candidate artifact', releaseCandidate.artifactPath),
    fact('Candidate destination', releaseCandidate.destinationTarget, releaseCandidate.provenanceComplete ? 'safe' : 'neutral'),
    fact('Publication', publishing.executed ? 'executed' : 'not executed', publishing.executed ? 'warn' : 'safe'),
    fact('Secrets', publishing.secretsUsed ? 'used' : 'not used', publishing.secretsUsed ? 'warn' : 'safe'),
    fact('Destination', `${destination.kind} · ${destinationTarget}`),
    fact('Verified artifact SHA-256', bundledArtifactSha256),
    fact('Build artifact SHA-256', build.artifactSha256),
    fact('QA artifact SHA-256', qa.artifactSha256),
    fact('Release candidate SHA-256', releaseCandidate.outputSha256)
  ].join('');

  const provenanceNote = releaseCandidate.provenanceComplete
    ? 'This release candidate carries explicit candidate identity and destination provenance.'
    : 'Legacy evidence does not carry explicit release-candidate identity/destination provenance; those fields are shown as unavailable rather than inferred.';

  return Buffer.from(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
  <title>Verified local starter · BYJTT</title>
  <style>
    :root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0d0f12;color:#f5f7fa}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#20262d 0,#0d0f12 48%);color:#f5f7fa}
    main{width:min(900px,calc(100% - 32px));margin:0 auto;padding:56px 0 72px}.eyebrow{margin:0 0 12px;color:#9faab7;font-size:.78rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(2rem,6vw,4rem);line-height:1;letter-spacing:-.045em}.lead{max-width:720px;margin:20px 0 28px;color:#c3cad2;font-size:1.05rem;line-height:1.65}
    .status{display:inline-flex;align-items:center;gap:9px;border:1px solid #315b47;border-radius:999px;padding:8px 12px;background:#13241c;color:#b8f1cf;font-weight:700}.status:before{content:"";width:8px;height:8px;border-radius:50%;background:#68d391}
    .actions{display:flex;flex-wrap:wrap;gap:12px;margin:30px 0}.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:10px;text-decoration:none;font-weight:750;border:1px solid #495461;color:#f7f9fb;background:#222831}.button-primary{background:#f5f7fa;color:#111417;border-color:#f5f7fa}
    .panel{margin-top:28px;border:1px solid #303842;border-radius:18px;background:#13171c;overflow:hidden}.panel h2{margin:0;padding:20px 22px;border-bottom:1px solid #303842;font-size:1rem}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.fact{padding:18px 22px;border-bottom:1px solid #252c34}.fact:nth-child(odd){border-right:1px solid #252c34}.fact dt{margin:0 0 7px;color:#9faab7;font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.fact dd{margin:0;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88rem;line-height:1.5}.fact-pass dd,.fact-safe dd{color:#9ee6ba}.fact-warn dd{color:#ffd38a}
    .boundary{margin-top:22px;padding:18px 20px;border-left:3px solid #6f7b88;background:#151a20;color:#c6cdd5;line-height:1.6}.boundary strong{color:#fff}.foot{margin-top:22px;color:#8e99a6;font-size:.9rem;line-height:1.6}
    @media(max-width:680px){main{padding-top:34px}.facts{grid-template-columns:1fr}.fact:nth-child(odd){border-right:0}.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">BYJTT · local verification</p>
    <h1>Verified local starter</h1>
    <p class="lead">This page is generated from the same machine-readable build, QA, release-candidate and publishing records packaged in this archive. The artifact digest below is checked against the bytes in <code>starter/</code> before this page can be created.</p>
    <div class="status">Build + QA evidence passed</div>
    <div class="actions">
      <a class="button button-primary" href="starter/dist/index.html">Open verified starter</a>
      <a class="button" href="PROJECT_BRIEF.html">View project brief</a>
      <a class="button" href="VERIFICATION.txt">Open plain-text verification</a>
    </div>
    <section class="panel" aria-labelledby="facts-title">
      <h2 id="facts-title">Verification facts</h2>
      <dl class="facts">${facts}</dl>
    </section>
    <div class="boundary"><strong>Evidence boundary:</strong> this result is local and dry-run only. ${escapeHtml(provenanceNote)} It does not claim store/provider publication, secret-backed execution, real requested-device execution, or human playability.</div>
    <p class="foot">For full provenance, inspect the JSON records under <code>evidence/</code>. This page contains no scripts and its Content Security Policy blocks network resources.</p>
  </main>
</body>
</html>
`, 'utf8');
}

const FAILED_RUN_PATHS = new Set(['/api/pipeline/runs', '/api/pipeline/brief-runs']);
const FAILED_RUN_SESSION_KEY = 'byjtt:studio:failed-run:v1';
let pendingFailedRun = null;
let failedReceiptUrl = null;

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failedStageStatus(key, evidence) {
  const value = evidence?.[key];
  if (!value) return 'blocked';
  if (key === 'intake') return value.validation?.status === 'pass' ? 'pass' : 'fail';
  if (key === 'registry') return Array.isArray(value.entries) && value.entries.length > 0 ? 'pass' : 'fail';
  if (key === 'build' || key === 'qa') return value.executed === true && value.status === 'pass' ? 'pass' : 'fail';
  if (key === 'releaseCandidate') return value.dryRunOnly === true ? 'pass' : 'fail';
  if (key === 'publishing') return value.executed === false && value.secretsUsed === false && value.dryRun === true && value.destination?.kind === 'local' && String(value.destination?.target || '').startsWith('local://') ? 'pass' : 'fail';
  return 'fail';
}

export function failedRunStageStatuses(result) {
  const receipt = buildFailedRunReceipt(result);
  return Object.fromEntries(['intake', 'registry', 'build', 'qa', 'releaseCandidate', 'publishing'].map((key) => [key, failedStageStatus(key, receipt.evidence)]));
}

export function buildFailedRunReceipt(result) {
  if (!plainObject(result) || result.status === 'pass') throw new Error('Failed-run receipt requires a non-passing pipeline result.');
  if (!plainObject(result.evidence) || Object.keys(result.evidence).length === 0) throw new Error('Failed-run receipt requires retained pipeline evidence.');
  const error = typeof result.error === 'string' && result.error.trim()
    ? result.error.trim().slice(0, 1000)
    : 'Pipeline stopped before verification completed.';
  return {
    schemaVersion: 1,
    kind: 'byjtt-local-failed-attempt-evidence',
    status: 'failed',
    error,
    brief: plainObject(result.brief) ? result.brief : null,
    safety: plainObject(result.safety) ? result.safety : null,
    evidence: result.evidence,
    authority: {
      playable: false,
      downloadableStarter: false,
      publication: false,
      secrets: false,
      note: 'This receipt preserves partial local execution evidence only. Missing or failed stages are not treated as executed or passing.'
    }
  };
}

export function serializeFailedRunForSession(result) {
  buildFailedRunReceipt(result);
  return JSON.stringify(result);
}

export function parseFailedRunFromSession(serialized) {
  if (typeof serialized !== 'string' || serialized.length === 0 || serialized.length > 1024 * 1024) {
    throw new Error('Stored failed-run evidence is missing or oversized.');
  }
  let result;
  try { result = JSON.parse(serialized); }
  catch { throw new Error('Stored failed-run evidence is malformed.'); }
  buildFailedRunReceipt(result);
  return result;
}

function storeFailedRunForRefresh(result) {
  try { window.sessionStorage.setItem(FAILED_RUN_SESSION_KEY, serializeFailedRunForSession(result)); }
  catch (error) { console.error('Failed-attempt evidence could not be retained for refresh:', error); }
}

function clearStoredFailedRun() {
  try { window.sessionStorage.removeItem(FAILED_RUN_SESSION_KEY); }
  catch {}
}

function failedEvidenceRow(title, status, detail) {
  const item = document.createElement('div');
  item.className = 'item';
  const row = document.createElement('div');
  row.className = 'row';
  const strong = document.createElement('b');
  strong.textContent = title;
  const badge = document.createElement('span');
  badge.className = `status ${status}`;
  badge.textContent = status;
  row.append(strong, badge);
  const pre = document.createElement('pre');
  pre.className = 'evidence-detail';
  pre.textContent = detail;
  item.append(row, pre);
  return item;
}

function restoreFailedJourney(result) {
  const statuses = failedRunStageStatuses(result);
  for (const [key, status] of Object.entries(statuses)) {
    const step = document.querySelector(`[data-run-step="${key}"]`);
    if (!step) continue;
    step.className = `step ${status}`;
    step.setAttribute('aria-label', `${step.querySelector('b')?.textContent || key}: ${status}`);
    const sub = step.querySelector('.sub');
    if (sub) sub.textContent = status;
  }
}

function renderFailedAttempt(result, { recovered = false } = {}) {
  const receipt = buildFailedRunReceipt(result);
  const container = document.querySelector('#run-evidence');
  const panel = document.querySelector('#run-evidence-panel');
  if (!container || !panel) return;
  container.replaceChildren();
  const summary = failedEvidenceRow('Failed attempt evidence', 'fail', [
    receipt.error,
    '',
    recovered
      ? 'Recovered from this browser tab after refresh. No pipeline stage was re-executed.'
      : 'Partial evidence is retained exactly as returned by the local pipeline.',
    'Missing stages remain blocked. No playable, verified starter, publication authority, or secret-backed operation is granted.'
  ].join('\n'));
  const actions = document.createElement('div');
  actions.className = 'gate-actions';
  const link = document.createElement('a');
  link.className = 'btn primary';
  link.textContent = 'Download failed-attempt evidence';
  link.download = 'failed-pipeline-evidence.json';
  if (failedReceiptUrl) URL.revokeObjectURL(failedReceiptUrl);
  failedReceiptUrl = URL.createObjectURL(new Blob([`${JSON.stringify(receipt, null, 2)}\n`], { type: 'application/json' }));
  link.href = failedReceiptUrl;
  actions.append(link);
  summary.append(actions);
  container.append(summary);
  const labels = { intake: 'Intake & scaffold', registry: 'Tool selection', build: 'Build', qa: 'QA evidence', releaseCandidate: 'Release candidate', publishing: 'Publishing plan', run: 'Pipeline run record' };
  const statuses = failedRunStageStatuses(result);
  for (const [key, value] of Object.entries(receipt.evidence)) {
    if (!plainObject(value)) continue;
    container.append(failedEvidenceRow(labels[key] || key, key === 'run' ? 'fail' : (statuses[key] || 'fail'), JSON.stringify(value, null, 2)));
  }
  panel.classList.remove('hidden');
  if (recovered) {
    restoreFailedJourney(result);
    const message = document.querySelector('#run-message');
    if (message) {
      message.className = 'notice fail';
      message.textContent = 'Recovered the latest failed attempt from this browser tab. No rebuild was run.';
    }
    document.querySelector('#play-result')?.classList.add('hidden');
  }
}

function restoreFailedRunAfterRefresh() {
  let serialized;
  try { serialized = window.sessionStorage.getItem(FAILED_RUN_SESSION_KEY); }
  catch { return; }
  if (!serialized) return;
  try {
    renderFailedAttempt(parseFailedRunFromSession(serialized), { recovered: true });
  } catch (error) {
    clearStoredFailedRun();
    console.error('Stored failed-attempt evidence was rejected:', error);
  }
}

function installFailedRunCapture() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    let url;
    try {
      const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
      url = new URL(rawUrl, location.href);
    } catch {
      return response;
    }
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (method === 'POST' && url.origin === location.origin && FAILED_RUN_PATHS.has(url.pathname)) {
      if (response.ok) clearStoredFailedRun();
      else {
        pendingFailedRun = response.clone().json().then((result) => {
          buildFailedRunReceipt(result);
          storeFailedRunForRefresh(result);
          return result;
        }).catch(() => null);
      }
    }
    if (method === 'DELETE' && response.ok && url.origin === location.origin && url.pathname === '/api/pipeline/runs/latest') {
      clearStoredFailedRun();
    }
    return response;
  };
}

function watchFailedRuns() {
  const message = document.querySelector('#run-message');
  if (!message || typeof MutationObserver === 'undefined') return;
  let rendering = false;
  const observer = new MutationObserver(async () => {
    if (rendering || !message.classList.contains('fail') || !pendingFailedRun) return;
    rendering = true;
    const captured = pendingFailedRun;
    pendingFailedRun = null;
    try {
      const result = await captured;
      if (result) renderFailedAttempt(result);
    } catch (error) {
      console.error('Failed-attempt evidence could not be rendered:', error);
    } finally {
      rendering = false;
    }
  });
  observer.observe(message, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installFailedRunCapture();
  watchFailedRuns();
  restoreFailedRunAfterRefresh();
}
