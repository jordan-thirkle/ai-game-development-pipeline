const TARGETS = new Set(['web', 'desktop', 'mobile']);
const MECHANICS = new Set(['collect', 'dodge', 'survive']);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanText(value, { min = 1, max, field }) {
  if (typeof value !== 'string' || value.length < min || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid project brief ${field}`);
  }
  return value;
}

export function readProjectBrief(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid project manifest');
  const name = cleanText(manifest.name, { max: 80, field: 'name' });
  const objective = cleanText(manifest.objective, { max: 500, field: 'objective' });
  const starter = manifest.starter;
  if (!starter || typeof starter !== 'object' || Array.isArray(starter)) throw new Error('Invalid project brief starter');
  const mechanic = starter.mechanic;
  const requestedTargetPlatform = starter.requestedTargetPlatform;
  const executedTargetPlatform = starter.executedTargetPlatform;
  if (!MECHANICS.has(mechanic)) throw new Error('Invalid project brief mechanic');
  if (!TARGETS.has(requestedTargetPlatform)) throw new Error('Invalid project brief requested target');
  if (executedTargetPlatform !== 'web') throw new Error('Invalid project brief executed target');
  return { name, objective, mechanic, requestedTargetPlatform, executedTargetPlatform };
}

export function createProjectBriefPage(manifest) {
  const brief = readProjectBrief(manifest);
  const targetCopy = brief.requestedTargetPlatform === brief.executedTargetPlatform
    ? `${brief.requestedTargetPlatform} · executed locally`
    : `${brief.requestedTargetPlatform} requested · ${brief.executedTargetPlatform} executed locally`;
  return Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(brief.name)} · Project brief</title><style>:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0d0f12;color:#f5f7fa}body{margin:0}main{width:min(760px,calc(100% - 32px));margin:auto;padding:48px 0}.eyebrow{color:#9faab7;text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;font-weight:700}h1{font-size:clamp(2rem,7vw,4rem);margin:.2em 0}.lead{color:#c3cad2;line-height:1.65;font-size:1.05rem;white-space:pre-wrap}.panel{margin-top:28px;border:1px solid #303842;border-radius:16px;background:#13171c;padding:22px}.fact{margin:0 0 18px}.fact:last-child{margin-bottom:0}.fact b{display:block;color:#9faab7;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.button{display:inline-block;padding:12px 16px;border-radius:10px;border:1px solid #495461;color:#fff;text-decoration:none;font-weight:750}.button.primary{background:#f5f7fa;color:#111417;border-color:#f5f7fa}.boundary{margin-top:24px;color:#9faab7;line-height:1.6}</style></head><body><main><div class="eyebrow">BYJTT · portable project brief</div><h1>${escapeHtml(brief.name)}</h1><p class="lead">${escapeHtml(brief.objective)}</p><section class="panel"><p class="fact"><b>Reviewed starter mechanic</b>${escapeHtml(brief.mechanic)}</p><p class="fact"><b>Target truth</b>${escapeHtml(targetCopy)}</p></section><div class="actions"><a class="button primary" href="START_HERE.html">Open verified starter</a><a class="button" href="VERIFICATION.html">View verification</a></div><p class="boundary">This page preserves the project intent packaged with this starter. It does not add execution evidence or upgrade a requested desktop/mobile target into native-device proof.</p></main></body></html>\n`, 'utf8');
}
