const runSteps = [
  ['intake', 'Intake & scaffold'],
  ['registry', 'Tool selection'],
  ['build', 'Build'],
  ['qa', 'QA evidence'],
  ['releaseCandidate', 'Release candidate'],
  ['publishing', 'Publishing plan']
];

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const REGISTRY_ENTRY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const REGISTRY_EVIDENCE_LABELS = new Set(['EXECUTED', 'SOURCE-VERIFIED', 'VENDOR-CLAIM', 'PAPER-CLAIM', 'UNKNOWN']);
const REGISTRY_SELECTION_MODES = new Set(['requested', 'deterministic-source-verified-default']);
const RECOVERABLE_TARGETS = new Set(['web', 'desktop', 'mobile']);
const RECOVERABLE_MECHANICS = new Set(['collect', 'dodge', 'survive']);
const MECHANIC_LABELS = {
  collect: 'Collect a beacon',
  dodge: 'Dodge to an exit',
  survive: 'Survive 10 seconds'
};
const NAME_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
const MULTILINE_CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

export function recoverableBriefValues(result) {
  const brief = result?.brief;
  if (brief == null) return null;
  if (typeof brief !== 'object' || Array.isArray(brief)) throw new Error('Recovered brief is malformed.');
  const { name, objective, targetPlatform, mechanic } = brief;
  if (
    typeof name !== 'string' ||
    name.trim().length < 1 ||
    name.length > 80 ||
    NAME_CONTROL_CHARACTER_PATTERN.test(name)
  ) throw new Error('Recovered brief name is invalid.');
  if (
    typeof objective !== 'string' ||
    objective.trim().length < 1 ||
    objective.length > 500 ||
    MULTILINE_CONTROL_CHARACTER_PATTERN.test(objective)
  ) throw new Error('Recovered brief objective is invalid.');
  if (!RECOVERABLE_TARGETS.has(targetPlatform)) throw new Error('Recovered brief target is invalid.');
  if (!RECOVERABLE_MECHANICS.has(mechanic)) throw new Error('Recovered brief mechanic is invalid.');
  return { name, objective, targetPlatform, mechanic };
}

function boundedRegistryText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength || NAME_CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new Error(`Recovered registry ${label} is invalid.`);
  }
  return value.trim();
}

export function buildSolvedSystemFacts(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) throw new Error('Recovered registry evidence is malformed.');
  if (!SHA256_PATTERN.test(String(registry.registryRevision))) throw new Error('Recovered registry revision is invalid.');
  if (!REGISTRY_SELECTION_MODES.has(registry.selectionMode)) throw new Error('Recovered registry selection mode is invalid.');
  if (!Array.isArray(registry.entries) || registry.entries.length === 0 || registry.entries.length > 16) throw new Error('Recovered registry evidence is incomplete.');
  const ids = new Set();
  const selected = registry.entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Recovered registry entry is malformed.');
    const entryId = boundedRegistryText(entry.entry_id, 'entry id', 160);
    if (!REGISTRY_ENTRY_ID_PATTERN.test(entryId) || ids.has(entryId)) throw new Error('Recovered registry entry id is invalid or duplicated.');
    ids.add(entryId);
    const name = boundedRegistryText(entry.name, 'entry name', 200);
    const evidence = boundedRegistryText(entry.execution_status, 'evidence label', 40);
    if (!REGISTRY_EVIDENCE_LABELS.has(evidence)) throw new Error('Recovered registry evidence label is invalid.');
    const licenceReview = boundedRegistryText(entry.license_review_status, 'licence review status', 160);
    return `${name} (${entryId}) · registry evidence ${evidence} · licence review ${licenceReview} · selection is not this run's runtime execution`;
  });
  return [
    ['Solved-system selection', selected.join('; ')],
    ['Registry provenance', `${registry.selectionMode} · ${registry.registryRevision}`]
  ];
}

export function buildInlineVerificationFacts(result) {
  if (result?.status !== 'pass' || !result.evidence) throw new Error('Latest run is not a passing evidence record.');
  if (result.evidence.intake?.validation?.status !== 'pass') throw new Error('Recovered intake evidence is not passing.');
  const solvedSystemFacts = buildSolvedSystemFacts(result.evidence.registry);
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
    ...solvedSystemFacts,
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
  recoverableBriefValues(result);
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
    'Solved-system selection below is registry/provenance evidence, not a claim that the selected external system executed in this run.',
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

function restoreBriefForm(result) {
  const values = recoverableBriefValues(result);
  if (!values) return;
  const name = document.querySelector('#brief-name');
  const objective = document.querySelector('#brief-objective');
  const target = document.querySelector('#brief-target');
  const mechanic = document.querySelector('#brief-mechanic');
  const advanced = document.querySelector('#creator-advanced');
  const suggestion = document.querySelector('#creator-suggestion');
  if (!name || !objective || !target || !mechanic) return;
  name.value = values.name;
  objective.value = values.objective;
  target.value = values.targetPlatform;
  mechanic.value = values.mechanic;
  if (advanced) advanced.open = true;
  if (suggestion) {
    suggestion.textContent = `Starter shape: ${MECHANIC_LABELS[values.mechanic]} · restored from the latest verified run.`;
  }
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

async function resetLatestRun() {
  const response = await fetch('/api/pipeline/runs/latest', { method: 'DELETE', headers: { accept: 'application/json' } });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).error || ''; } catch {}
    throw new Error(detail || `Latest-run reset failed (${response.status}).`);
  }
  const payload = await response.json();
  if (payload?.reset !== true) throw new Error('Latest-run reset response was malformed.');
}

function ensureStartNewProjectAction() {
  if (document.querySelector('#start-new-project')) return;
  const header = document.querySelector('#play-result header');
  if (!header) return;
  const button = document.createElement('button');
  button.className = 'btn';
  button.id = 'start-new-project';
  button.type = 'button';
  button.textContent = 'Start new project';
  button.style.float = 'right';
  button.style.marginRight = '8px';
  button.addEventListener('click', async () => {
    button.disabled = true;
    const message = document.querySelector('#run-message');
    try {
      await resetLatestRun();
      location.reload();
    } catch (error) {
      button.disabled = false;
      if (message) {
        message.className = 'notice fail';
        message.textContent = `New project was not started: ${error.message}`;
      }
    }
  });
  header.append(button);
}

async function recoverLatestRun() {
  const envelope = await fetchLatestRun();
  if (envelope?.available === false) return;
  if (envelope?.available !== true || !envelope.run) throw new Error('Latest-run recovery response was malformed.');
  const result = envelope.run;
  const { playable, download } = assertRecoverableRun(result);
  restoreBriefForm(result);
  restoreJourney();
  restoreEvidence(result, download);
  const message = document.querySelector('#run-message');
  if (message) {
    message.className = 'notice pass';
    message.textContent = result.brief
      ? 'Recovered the latest verified run and its Creator Mode brief from this Studio session. No rebuild or re-entry was needed.'
      : 'Recovered the latest verified run from this Studio session. No rebuild was needed.';
  }
  const frame = document.querySelector('#play-frame');
  const panel = document.querySelector('#play-result');
  if (frame && panel) {
    frame.src = playable.href;
    panel.classList.remove('hidden');
  }
  document.querySelector('#open-result')?.addEventListener('click', () => window.open(playable.href, '_blank', 'noopener,noreferrer'));
  ensureStartNewProjectAction();
}

function watchFreshRuns() {
  const container = document.querySelector('#run-evidence');
  if (!container || typeof MutationObserver === 'undefined') return;
  let checking = false;
  const observer = new MutationObserver(async () => {
    if (container.children.length > 0) ensureStartNewProjectAction();
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
