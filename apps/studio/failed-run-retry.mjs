import { recoverableBriefValues } from './latest-run-recovery.mjs';

const FAILED_RUN_SESSION_KEY = 'byjtt:studio:failed-run:v1';
const RETRY_DRAFT_SESSION_KEY = 'byjtt:studio:failed-retry-draft:v1';
const RETRY_BUTTON_ID = 'retry-failed-project';
const EDIT_BUTTON_ID = 'edit-failed-project';
const REVIEW_ID = 'failed-retry-preflight';
const MAX_RETRY_DRAFT_BYTES = 4096;
const FIELD_LABELS = {
  name: 'Project name',
  objective: 'Objective',
  targetPlatform: 'Requested target',
  mechanic: 'Mechanic'
};

let activeRetryBaseline = null;

function sameBrief(left, right) {
  return Boolean(left && right) && Object.keys(FIELD_LABELS).every((key) => left[key] === right[key]);
}

function clearRetryDraft() {
  try { window.sessionStorage.removeItem(RETRY_DRAFT_SESSION_KEY); } catch {}
}

function validateBrief(brief) {
  return recoverableBriefValues({ brief });
}

function readRetryDraft(expectedBaseline) {
  let serialized;
  try { serialized = window.sessionStorage.getItem(RETRY_DRAFT_SESSION_KEY); }
  catch { return null; }
  if (!serialized) return null;
  if (serialized.length > MAX_RETRY_DRAFT_BYTES) {
    clearRetryDraft();
    return null;
  }
  try {
    const record = JSON.parse(serialized);
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Malformed retry draft.');
    const baseline = validateBrief(record.baseline);
    const draft = validateBrief(record.draft);
    if (!sameBrief(baseline, expectedBaseline)) {
      clearRetryDraft();
      return null;
    }
    return draft;
  } catch {
    clearRetryDraft();
    return null;
  }
}

function writeRetryDraft(baseline, draft) {
  const record = {
    baseline: validateBrief(baseline),
    draft: validateBrief(draft)
  };
  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_RETRY_DRAFT_BYTES) throw new Error('Retry draft is too large to preserve safely.');
  try { window.sessionStorage.setItem(RETRY_DRAFT_SESSION_KEY, serialized); }
  catch { throw new Error('Retry draft could not be preserved in this browser session.'); }
}

function readRetryableFailure() {
  let serialized;
  try { serialized = window.sessionStorage.getItem(FAILED_RUN_SESSION_KEY); }
  catch { return null; }
  if (!serialized || serialized.length > 1024 * 1024) return null;
  let result;
  try { result = JSON.parse(serialized); }
  catch { return null; }
  if (!result || result.status === 'pass' || !result.evidence || typeof result.evidence !== 'object' || Array.isArray(result.evidence) || Object.keys(result.evidence).length === 0) return null;
  try {
    const brief = recoverableBriefValues(result);
    return brief ? { result, brief } : null;
  } catch {
    return null;
  }
}

function creatorBriefValues() {
  const name = document.querySelector('#brief-name');
  const objective = document.querySelector('#brief-objective');
  const target = document.querySelector('#brief-target');
  const mechanic = document.querySelector('#brief-mechanic');
  if (!name || !objective || !target || !mechanic) throw new Error('Creator Mode brief controls are unavailable.');
  return {
    name: name.value,
    objective: objective.value,
    targetPlatform: target.value,
    mechanic: mechanic.value
  };
}

function applyRetryBrief(brief, { submit = true } = {}) {
  const name = document.querySelector('#brief-name');
  const objective = document.querySelector('#brief-objective');
  const target = document.querySelector('#brief-target');
  const mechanic = document.querySelector('#brief-mechanic');
  const advanced = document.querySelector('#creator-advanced');
  const form = document.querySelector('#brief-form');
  const submitButton = document.querySelector('#run-brief');
  if (!name || !objective || !target || !mechanic || !form || !submitButton) throw new Error('Creator Mode retry controls are unavailable.');
  name.value = brief.name;
  objective.value = brief.objective;
  target.value = brief.targetPlatform;
  mechanic.value = brief.mechanic;
  if (advanced) advanced.open = true;
  if (submit) form.requestSubmit(submitButton);
  else name.focus();
}

function showRetryPreparationMessage({ restored = false } = {}) {
  const message = document.querySelector('#run-message');
  if (!message) return;
  message.className = 'notice';
  message.textContent = restored
    ? 'Recovered your unsent retry edits from this browser session. No pipeline stage was re-executed; review the preflight changes, then create the playable starter.'
    : 'Recovered the failed brief for editing. No pipeline stage was re-executed; review the preflight changes, then create the playable starter.';
}

function renderRetryPreflight(originalBrief) {
  const form = document.querySelector('#brief-form');
  if (!form) throw new Error('Creator Mode brief form is unavailable.');
  let panel = document.querySelector(`#${REVIEW_ID}`);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = REVIEW_ID;
    panel.className = 'item';
    panel.setAttribute('aria-live', 'polite');
    form.append(panel);
  }

  const currentBrief = creatorBriefValues();
  const changed = Object.keys(FIELD_LABELS).filter((key) => currentBrief[key] !== originalBrief[key]);
  panel.replaceChildren();

  const title = document.createElement('b');
  title.textContent = 'Retry preflight';
  const summary = document.createElement('p');
  summary.textContent = changed.length === 0
    ? 'No brief changes yet. Submitting now would retry the same validated project brief.'
    : `${changed.length} brief field${changed.length === 1 ? '' : 's'} changed. No pipeline stage has executed since recovery.`;
  panel.append(title, summary);

  if (changed.length > 0) {
    const list = document.createElement('ul');
    for (const key of changed) {
      const item = document.createElement('li');
      const label = document.createElement('strong');
      label.textContent = `${FIELD_LABELS[key]}: `;
      const values = document.createElement('span');
      values.textContent = `${originalBrief[key]} → ${currentBrief[key]}`;
      item.append(label, values);
      list.append(item);
    }
    panel.append(list);
  }

  const authority = document.createElement('p');
  authority.textContent = 'Execution authority: none until you explicitly choose Create playable starter. Retry remains local dry-run only.';
  panel.append(authority);
  return { changed, currentBrief };
}

function beginEditableRetry(originalBrief, draft = originalBrief, { restored = false } = {}) {
  activeRetryBaseline = { ...originalBrief };
  applyRetryBrief(validateBrief(draft), { submit: false });
  showRetryPreparationMessage({ restored });
  const firstPreflight = renderRetryPreflight(activeRetryBaseline);
  writeRetryDraft(activeRetryBaseline, firstPreflight.currentBrief);
  const form = document.querySelector('#brief-form');
  if (!form || form.dataset.retryPreflightBound === 'true') return;
  form.dataset.retryPreflightBound = 'true';
  const refresh = () => {
    if (!activeRetryBaseline || !document.querySelector(`#${REVIEW_ID}`)) return;
    try {
      const preflight = renderRetryPreflight(activeRetryBaseline);
      writeRetryDraft(activeRetryBaseline, preflight.currentBrief);
    } catch (error) {
      const message = document.querySelector('#run-message');
      if (message) {
        message.className = 'notice fail';
        message.textContent = `Retry edits could not be preserved: ${error.message}`;
      }
    }
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  form.addEventListener('submit', () => {
    activeRetryBaseline = null;
    clearRetryDraft();
    document.querySelector(`#${REVIEW_ID}`)?.remove();
  });
}

function ensureRetryActions() {
  const retryable = readRetryableFailure();
  if (!retryable) {
    activeRetryBaseline = null;
    clearRetryDraft();
    document.querySelector(`#${REVIEW_ID}`)?.remove();
    return;
  }
  const evidencePanel = document.querySelector('#run-evidence-panel');
  if (!evidencePanel || evidencePanel.classList.contains('hidden')) return;
  const failedTitle = [...evidencePanel.querySelectorAll('.item b')].find((node) => node.textContent === 'Failed attempt evidence');
  const actions = failedTitle?.closest('.item')?.querySelector('.gate-actions');
  if (!actions) return;

  if (!document.querySelector(`#${RETRY_BUTTON_ID}`)) {
    const button = document.createElement('button');
    button.className = 'btn';
    button.id = RETRY_BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Retry same project';
    button.addEventListener('click', () => {
      button.disabled = true;
      button.textContent = 'Retrying…';
      clearRetryDraft();
      try { applyRetryBrief(retryable.brief); }
      catch (error) {
        button.disabled = false;
        button.textContent = 'Retry same project';
        const message = document.querySelector('#run-message');
        if (message) {
          message.className = 'notice fail';
          message.textContent = `Retry was not started: ${error.message}`;
        }
      }
    });
    actions.append(button);
  }

  if (!document.querySelector(`#${EDIT_BUTTON_ID}`)) {
    const editButton = document.createElement('button');
    editButton.className = 'btn secondary';
    editButton.id = EDIT_BUTTON_ID;
    editButton.type = 'button';
    editButton.textContent = 'Edit before retry';
    editButton.addEventListener('click', () => {
      try { beginEditableRetry(retryable.brief); }
      catch (error) {
        const message = document.querySelector('#run-message');
        if (message) {
          message.className = 'notice fail';
          message.textContent = `Failed brief could not be prepared for editing: ${error.message}`;
        }
      }
    });
    actions.append(editButton);
  }

  if (!document.querySelector(`#${REVIEW_ID}`)) {
    const draft = readRetryDraft(retryable.brief);
    if (draft) {
      try { beginEditableRetry(retryable.brief, draft, { restored: true }); }
      catch {
        clearRetryDraft();
      }
    }
  }
}

const PORTABLE_MANIFEST_MAX_BYTES = 64 * 1024;
const PORTABLE_TARGETS = new Set(['web', 'desktop', 'mobile']);
const PORTABLE_MECHANICS = new Set(['collect', 'dodge', 'survive']);
const PORTABLE_IMPORT_INPUT_ID = 'portable-starter-manifest';
const PORTABLE_IMPORT_BUTTON_ID = 'portable-starter-import';
const PORTABLE_IMPORT_STATUS_ID = 'portable-starter-status';

function portableObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function portableText(value, label, maxLength) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  if (/[^\P{Cc}\t\n\r]/u.test(text) || /[\u0000-\u001f\u007f]/.test(text)) throw new Error(`${label} contains unsupported control characters.`);
  return text;
}

export function portableStarterBriefFromManifest(value) {
  const manifest = portableObject(value, 'Starter manifest');
  if (manifest.manifestVersion !== '1.0.0') throw new Error('Starter manifest must use manifestVersion 1.0.0.');
  if (!Array.isArray(manifest.targetPlatforms) || manifest.targetPlatforms.length !== 1 || manifest.targetPlatforms[0] !== 'web') {
    throw new Error('Starter manifest must retain the reviewed local web target only.');
  }
  const starter = portableObject(manifest.starter, 'Starter intent');
  const requestedTarget = portableText(starter.requestedTargetPlatform, 'Requested target', 20).toLowerCase();
  if (!PORTABLE_TARGETS.has(requestedTarget)) throw new Error('Requested target must be web, desktop, or mobile.');
  if (starter.executedTargetPlatform !== 'web') throw new Error('Starter manifest executed target must remain local web.');
  const expectedStatus = requestedTarget === 'web' ? 'executed-local-web' : 'requested-not-executed';
  if (starter.targetExecutionStatus !== expectedStatus) throw new Error('Starter manifest target execution status contradicts the requested/executed target boundary.');
  const mechanic = portableText(starter.mechanic, 'Starter mechanic', 20).toLowerCase();
  if (!PORTABLE_MECHANICS.has(mechanic)) throw new Error('Starter mechanic must be collect, dodge, or survive.');
  const publish = portableObject(manifest.publish, 'Publication plan');
  if (publish.provider !== 'local' || typeof publish.destination !== 'string' || !publish.destination.startsWith('local://planned/')) {
    throw new Error('Starter manifest must retain a local-only publication plan.');
  }
  return {
    name: portableText(manifest.name, 'Project name', 80),
    objective: portableText(manifest.objective, 'Project objective', 500),
    targetPlatform: requestedTarget,
    mechanic
  };
}

export function parsePortableStarterBriefText(text) {
  if (typeof text !== 'string') throw new Error('Starter manifest must be text.');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('Starter manifest must contain valid JSON.'); }
  return portableStarterBriefFromManifest(parsed);
}

function portableImportMessage(kind, text) {
  const status = document.querySelector(`#${PORTABLE_IMPORT_STATUS_ID}`);
  if (!status) return;
  status.className = `notice ${kind}`;
  status.textContent = text;
}

function applyPortableBrief(brief) {
  const evidencePanel = document.querySelector('#run-evidence-panel');
  const playResult = document.querySelector('#play-result');
  if ((evidencePanel && !evidencePanel.classList.contains('hidden')) || (playResult && !playResult.classList.contains('hidden'))) {
    throw new Error('Start a new project before loading another starter manifest so prior evidence cannot be confused with new planning intent.');
  }
  const name = document.querySelector('#brief-name');
  const objective = document.querySelector('#brief-objective');
  const target = document.querySelector('#brief-target');
  const mechanic = document.querySelector('#brief-mechanic');
  const advanced = document.querySelector('#creator-advanced');
  if (!name || !objective || !target || !mechanic) throw new Error('Creator Mode brief controls are unavailable.');
  name.value = brief.name;
  objective.value = brief.objective;
  target.value = brief.targetPlatform;
  mechanic.value = brief.mechanic;
  if (advanced) advanced.open = true;
  mechanic.dispatchEvent(new Event('change', { bubbles: true }));
  const runMessage = document.querySelector('#run-message');
  if (runMessage) {
    runMessage.className = 'notice';
    runMessage.textContent = 'Starter planning intent loaded locally. Nothing has run for this imported brief; review it, then explicitly choose Create playable starter.';
  }
}

function ensurePortableStarterImport() {
  const form = document.querySelector('#brief-form');
  const actions = form?.querySelector('.brief-actions');
  if (!form || !actions || document.querySelector(`#${PORTABLE_IMPORT_BUTTON_ID}`)) return;

  const status = document.createElement('div');
  status.id = PORTABLE_IMPORT_STATUS_ID;
  status.className = 'notice';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Continue a downloaded starter by selecting starter/project.manifest.json. Studio reads planning intent in this browser only; nothing is uploaded or executed.';
  actions.before(status);

  const input = document.createElement('input');
  input.id = PORTABLE_IMPORT_INPUT_ID;
  input.className = 'hidden';
  input.type = 'file';
  input.accept = '.json,application/json';
  form.append(input);

  const button = document.createElement('button');
  button.id = PORTABLE_IMPORT_BUTTON_ID;
  button.className = 'btn';
  button.type = 'button';
  button.textContent = 'Continue from starter manifest';
  actions.prepend(button);
  button.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (document.querySelector('#run-brief')?.disabled || document.querySelector('#run-sample')?.disabled) throw new Error('Wait for the current local run to finish before loading a starter manifest.');
      if (file.size <= 0 || file.size > PORTABLE_MANIFEST_MAX_BYTES) throw new Error(`Starter manifest must be between 1 byte and ${PORTABLE_MANIFEST_MAX_BYTES} bytes.`);
      const brief = parsePortableStarterBriefText(await file.text());
      applyPortableBrief(brief);
      portableImportMessage('pass', `Planning intent loaded locally from ${file.name}. No file was uploaded and no execution evidence was imported. Review the four Creator fields before you explicitly run the reviewed local scaffold.`);
    } catch (error) {
      portableImportMessage('fail', `Starter manifest was not loaded: ${error.message}`);
    } finally {
      input.value = '';
    }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  ensureRetryActions();
  ensurePortableStarterImport();
  const panel = document.querySelector('#run-evidence-panel');
  if (panel && typeof MutationObserver !== 'undefined') {
    new MutationObserver(ensureRetryActions).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}
