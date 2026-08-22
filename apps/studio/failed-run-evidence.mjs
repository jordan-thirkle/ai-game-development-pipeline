const RUN_PATHS = new Set(['/api/pipeline/runs', '/api/pipeline/brief-runs']);
const MAX_ERROR_LENGTH = 1000;
let pendingFailedRun = null;
let failedReceiptUrl = null;

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function stageStatus(key, evidence) {
  const value = evidence?.[key];
  if (!value) return 'blocked';
  if (key === 'intake') return value.validation?.status === 'pass' ? 'pass' : 'fail';
  if (key === 'registry') return Array.isArray(value.entries) && value.entries.length > 0 ? 'pass' : 'fail';
  if (key === 'build' || key === 'qa') return value.executed === true && value.status === 'pass' ? 'pass' : 'fail';
  if (key === 'releaseCandidate') return value.dryRunOnly === true ? 'pass' : 'fail';
  if (key === 'publishing') {
    return value.executed === false && value.secretsUsed === false && value.dryRun === true && value.destination?.kind === 'local' && String(value.destination?.target || '').startsWith('local://') ? 'pass' : 'fail';
  }
  return 'fail';
}

export function buildFailedRunReceipt(result) {
  if (!plainObject(result) || result.status === 'pass') throw new Error('Failed-run receipt requires a non-passing pipeline result.');
  if (!plainObject(result.evidence) || Object.keys(result.evidence).length === 0) throw new Error('Failed-run receipt requires retained pipeline evidence.');
  const error = typeof result.error === 'string' && result.error.trim()
    ? result.error.trim().slice(0, MAX_ERROR_LENGTH)
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

export function failedRunStageStatuses(result) {
  const receipt = buildFailedRunReceipt(result);
  return Object.fromEntries(['intake', 'registry', 'build', 'qa', 'releaseCandidate', 'publishing'].map((key) => [key, stageStatus(key, receipt.evidence)]));
}

function evidenceRow(title, status, detail) {
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

function renderFailedAttempt(result) {
  const receipt = buildFailedRunReceipt(result);
  const container = document.querySelector('#run-evidence');
  const panel = document.querySelector('#run-evidence-panel');
  if (!container || !panel) return;
  container.replaceChildren();

  const summary = evidenceRow('Failed attempt evidence', 'fail', [
    receipt.error,
    '',
    'Partial evidence is retained below exactly as returned by the local pipeline.',
    'Missing stages remain blocked. No playable, verified starter, publication authority, or secret-backed operation is granted.'
  ].join('\n'));
  const actions = document.createElement('div');
  actions.className = 'gate-actions';
  const download = document.createElement('a');
  download.className = 'btn primary';
  download.textContent = 'Download failed-attempt evidence';
  download.download = 'failed-pipeline-evidence.json';
  if (failedReceiptUrl) URL.revokeObjectURL(failedReceiptUrl);
  failedReceiptUrl = URL.createObjectURL(new Blob([`${JSON.stringify(receipt, null, 2)}\n`], { type: 'application/json' }));
  download.href = failedReceiptUrl;
  actions.append(download);
  summary.append(actions);
  container.append(summary);

  const labels = {
    intake: 'Intake & scaffold',
    registry: 'Tool selection',
    build: 'Build',
    qa: 'QA evidence',
    releaseCandidate: 'Release candidate',
    publishing: 'Publishing plan',
    run: 'Pipeline run record'
  };
  const statuses = failedRunStageStatuses(result);
  for (const [key, value] of Object.entries(receipt.evidence)) {
    if (!plainObject(value)) continue;
    const status = key === 'run' ? 'fail' : (statuses[key] || 'fail');
    container.append(evidenceRow(labels[key] || key, status, JSON.stringify(value, null, 2)));
  }
  panel.classList.remove('hidden');
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
    if (method === 'POST' && !response.ok && url.origin === location.origin && RUN_PATHS.has(url.pathname)) {
      pendingFailedRun = response.clone().json().then((result) => {
        buildFailedRunReceipt(result);
        return result;
      }).catch(() => null);
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
}
