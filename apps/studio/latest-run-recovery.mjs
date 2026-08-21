const runSteps = [
  ['intake', 'Intake & scaffold'],
  ['registry', 'Tool selection'],
  ['build', 'Build'],
  ['qa', 'QA evidence'],
  ['releaseCandidate', 'Release candidate'],
  ['publishing', 'Publishing plan']
];

function safeRelativeUrl(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) return null;
  const url = new URL(value, location.href);
  return url.origin === location.origin ? url : null;
}

function assertRecoverableRun(result) {
  if (result?.status !== 'pass' || !result.evidence) throw new Error('Latest run is not a passing evidence record.');
  if (result.evidence.intake?.validation?.status !== 'pass') throw new Error('Recovered intake evidence is not passing.');
  if (!Array.isArray(result.evidence.registry?.entries) || result.evidence.registry.entries.length === 0) throw new Error('Recovered registry evidence is incomplete.');
  if (result.evidence.build?.executed !== true || result.evidence.build?.status !== 'pass') throw new Error('Recovered build evidence is incomplete.');
  if (result.evidence.qa?.executed !== true || result.evidence.qa?.status !== 'pass') throw new Error('Recovered QA evidence is incomplete.');
  if (result.evidence.releaseCandidate?.dryRunOnly !== true) throw new Error('Recovered release candidate is not dry-run only.');
  if (
    result.safety?.dryRun !== true ||
    result.safety?.publicationExecuted !== false ||
    result.safety?.secretsUsed !== false ||
    result.safety?.destination?.kind !== 'local' ||
    !String(result.safety?.destination?.target).startsWith('local://')
  ) throw new Error('Recovered publishing safety evidence did not pass.');
  const playable = safeRelativeUrl(result.playable?.launchUrl, /^\/play\/sample\/$/);
  const download = safeRelativeUrl(result.download?.url, /^\/api\/pipeline\/downloads\/[0-9a-f-]+$/i);
  if (!playable || !download || !String(result.download?.filename).endsWith('.tar.gz') || !/^sha256:[a-f0-9]{64}$/.test(String(result.download?.sha256))) {
    throw new Error('Recovered artifact handles are not safe.');
  }
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
  for (const [key, label] of runSteps) {
    const value = result.evidence[key];
    if (value) container.append(textRow(label, 'pass', JSON.stringify(value, null, 2)));
  }
  panel.classList.remove('hidden');
}

async function recoverLatestRun() {
  const response = await fetch('/api/pipeline/runs/latest', { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Latest-run recovery failed (${response.status}).`);
  const envelope = await response.json();
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

recoverLatestRun().catch((error) => {
  const message = document.querySelector('#run-message');
  if (message) {
    message.className = 'notice fail';
    message.textContent = `Latest run was not restored: ${error.message}`;
  }
  console.error(error);
});
