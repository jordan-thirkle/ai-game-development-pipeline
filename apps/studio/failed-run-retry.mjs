import { recoverableBriefValues } from './latest-run-recovery.mjs';

const FAILED_RUN_SESSION_KEY = 'byjtt:studio:failed-run:v1';
const RETRY_BUTTON_ID = 'retry-failed-project';
const EDIT_BUTTON_ID = 'edit-failed-project';

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

function showRetryPreparationMessage() {
  const message = document.querySelector('#run-message');
  if (!message) return;
  message.className = 'notice';
  message.textContent = 'Recovered the failed brief for editing. No pipeline stage was re-executed; review your changes, then create the playable starter.';
}

function ensureRetryActions() {
  const retryable = readRetryableFailure();
  if (!retryable) return;
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
      try {
        applyRetryBrief(retryable.brief, { submit: false });
        showRetryPreparationMessage();
      } catch (error) {
        const message = document.querySelector('#run-message');
        if (message) {
          message.className = 'notice fail';
          message.textContent = `Failed brief could not be prepared for editing: ${error.message}`;
        }
      }
    });
    actions.append(editButton);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  ensureRetryActions();
  const panel = document.querySelector('#run-evidence-panel');
  if (panel && typeof MutationObserver !== 'undefined') {
    new MutationObserver(ensureRetryActions).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}
