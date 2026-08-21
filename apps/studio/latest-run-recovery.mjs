const runSteps = [
  ['intake', 'Intake & scaffold'],
  ['registry', 'Tool selection'],
  ['build', 'Build'],
  ['qa', 'QA evidence'],
  ['releaseCandidate', 'Release candidate'],
  ['publishing', 'Publishing plan']
];

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function buildInlineVerificationFacts(result) {
  if (result?.status !== 'pass' || !result.evidence) throw new Error('Latest run is not a passing evidence record.');
  if (result.evidence.intake?.validation?.status !== 'pass') throw new Error('Recovered intake evidence is not passing.');
  if (!Array.isArray(result.evidence.registry?.entries) || result.evidence.registry.entries.length === 0) throw new Error('Recovered registry evidence is incomplete.');
  const build = result.evidence.build;
  const qa = result.evidence.qa;
  const release = result.evidence.releaseCandidate;
  if (build?.executed !== true || build?.status !== 'pass') throw new Error('Recovered build evidence is incomplete.');
  if (qa?.executed !== true || qa?.status !== 'pass') throw new Error('Recovered QA evidence is incomplete.');
  if (release?.dryRunOnly !== true) throw new Error('Recovered release candidate is not dry-run only.');
  if (
    result.safety?.dryRun !== true ||
    result.safety?.publicationExecuted !== false ||
    result.safety?.secretsUsed !== false ||
    result.safety?.destination?.kind !== 'local' ||
    !String(result.safety?.destination?.target).startsWith('local://')
  ) throw new Error('Recovered publishing safety evidence did not pass.');
  const hashes = [build?.artifactSha256, qa?.artifactSha256, release?.build?.outputSha256];
  if (!hashes.every((value) => SHA256_PATTERN.test(String(value))) || !hashes.every((value) => value === hashes[0])) {
    throw new Error('Recovered artifact evidence is not revision-consistent.');
  }
  if (!result.download || !String(result.download.filename).endsWith('.tar.gz') || !SHA256_PATTERN.test(String(result.download.sha256))) {
    throw new Error('Verified local starter download was not produced.');
  }
  return [
    ['Build', 'executed · pass'],
    ['QA', 'executed · pass'],
    ['Release candidate', 'dry-run only'],
    ['Publication', 'not executed'],
    ['Secrets', 'not used'],
    ['Destination', String(result.safety.destination.target)],
    ['Verified artifact', hashes[0]],
    ['Starter bundle', result.download.sha256]
  ];
}

function safeRelativeUrl(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) return null;
  const url = new URL(value, location.href);
  return url.origin === location.origin ? url : null;
}

function assertRecoverableRun(result) {
  buildInlineVerificationFacts(result);
  const playable = safeRelativeUrl(result.playable?.launchUrl, /^\/play\/sample\/$/);
  const download = safeRelativeUrl(result.download?.url, /^\/api\/pipeline\/downloads\/[0-9a-f-]+$/i);
  if (!playable || !download) throw new Error('Recovered artifact handles are not safe.');
  return { playable, download };
}

function textRow(title, status, detail) {
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

function verificationText(result) {
  return [
    'Human-readable summary of the same machine evidence used by this local run.',
    'This does not claim store/provider publication, secret-backed execution, requested native/device execution, or human playability.',
    '',
    ...buildInlineVerificationFacts(result).map(([label, value]) => `${label}: ${value}`),
    '',
    'The downloaded starter also contains VERIFICATION.html, VERIFICATION.txt, and the full evidence/ JSON records.'
  ].join('\n');
}

function appendInlineVerification(result, container = document.querySelector('#run-evidence')) {
  if (!container || container.querySelector('[data-inline-verification="true"]')) return;
  const row = textRow('Verification summary', 'pass', verificationText(result));
  row.dataset.inlineVerification = 'true';
  const first = container.firstElementChild;
  if (first) first.insertAdjacentElement('afterend', row);
  else container.append(row);
}

function restoreJourney() {
  for (const [key] of runSteps) {
    const step = document.querySelector(`[data-run-step="${key}"]`);
    if (!step) continue;
    step.className = 'step pass';
    step.setAttribute('aria-label', `${step.querySelector('b')?.textContent || key}: pass`);
    const status = step.querySelector('.sub');
    if (status) status.textContent = status.textContent.replace(/planned|blocked|running|fail/, 'pass');
  }
}

function restoreEvidence(result, downloadUrl) {
  const container = document.querySelector('#run-evidence');
  const panel = document.querySelector('#run-evidence-panel');
  if (!container || !panel) return;
  container.replaceChildren();
  if (result.brief) {
    container.append(textRow('Applied brief', 'pass', [result.brief.name, result.brief.objective, `Target: ${result.brief.targetPlatform}`, `Mechanic: ${result.brief.mechanic}`, `Project: ${result.brief.projectId}`].join('\n')));
  }
  const downloadItem = textRow('Verified local starter', 'pass', `${result.download.fileCount} files · ${result.download.sizeBytes} compressed bytes · ${result.download.sha256}`);
  const actions = document.createElement('div');
  actions.className = 'gate-actions';
  const link = document.createElement('a');
  link.className = 'btn primary';
  link.href = downloadUrl.href;
  link.download = result.download.filename;
  link.textContent = 'Download starter bundle';
  actions.append(link);
  downloadItem.append(actions);
  container.append(downloadItem);
  appendInlineVerification(result, container);
  for (const [key, label] of runSteps) {
    const value = result.evidence[key];
    if (value) container.append(textRow(label, 'pass', JSON.stringify(value, null, 2)));
  }
  panel.classList.remove('hidden');
}

async function fetchLatestRun() {
  const response = await fetch('/api/pipeline/runs/latest', { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Latest-run recovery failed (${response.status}).`);
  return response.json();
}

async function recoverLatestRun() {
  const envelope = await fetchLatestRun();
  if (envelope?.available === false) return;
  if (envelope?.available !== true || !envelope.run) throw new Error('Latest-run recovery response was malformed.');
  const result = envelope.run;
  const { playable, download } = assertRecoverableRun(result);
  restoreJourney();
  restoreEvidence(result, download);
  const message = document.querySelector('#run-message');
  if (message) {
    message.className = 'notice pass';
    message.textContent = 'Recovered the latest verified run from this Studio session. No rebuild was needed.';
  }
  const frame = document.querySelector('#play-frame');
  const panel = document.querySelector('#play-result');
  if (frame && panel) {
    frame.src = playable.href;
    panel.classList.remove('hidden');
  }
  document.querySelector('#open-result')?.addEventListener('click', () => window.open(playable.href, '_blank', 'noopener,noreferrer'));
}

function watchFreshRuns() {
  const container = document.querySelector('#run-evidence');
  if (!container || typeof MutationObserver === 'undefined') return;
  let checking = false;
  const observer = new MutationObserver(async () => {
    if (checking || container.querySelector('[data-inline-verification="true"]') || container.children.length === 0) return;
    checking = true;
    try {
      const envelope = await fetchLatestRun();
      if (envelope?.available === true && envelope.run) appendInlineVerification(envelope.run, container);
    } catch (error) {
      console.error('Inline verification summary was not attached:', error);
    } finally {
      checking = false;
    }
  });
  observer.observe(container, { childList: true });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  watchFreshRuns();
  recoverLatestRun().catch((error) => {
    const message = document.querySelector('#run-message');
    if (message) {
      message.className = 'notice fail';
      message.textContent = `Latest run was not restored: ${error.message}`;
    }
    console.error(error);
  });
}
