const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function publishingPlanProjection(publishing, destinationTarget) {
  if (publishing?.plan === undefined) {
    return {
      available: false,
      copy: 'Publishing plan unavailable in this retained receipt. No publication is implied; inspect the machine-readable evidence before any external action.'
    };
  }
  const expectedPlan = `Would publish release-candidate.json to ${destinationTarget}`;
  const plan = publishing.plan;
  const safe = publishing?.dryRun === true
    && publishing?.executed === false
    && publishing?.provider === null
    && publishing?.storeOperation === null
    && publishing?.secretsUsed === false
    && publishing?.releaseCandidatePath === 'release-candidate.json'
    && Array.isArray(plan)
    && plan.length === 1
    && plan[0] === expectedPlan
    && !/[\u0000-\u001f\u007f]/.test(plan[0])
    && !/https?:\/\/|javascript:/i.test(plan[0]);
  if (!safe) throw new Error('Starter home requires a truthful local-only dry-run publishing plan');
  return { available: true, copy: plan[0] };
}

export function createStarterHomePage(manifest, evidence, bundledArtifactSha256) {
  const name = typeof manifest?.name === 'string' ? manifest.name : '';
  const objective = typeof manifest?.objective === 'string' ? manifest.objective : '';
  const starter = manifest?.starter;
  const mechanic = typeof starter?.mechanic === 'string' ? starter.mechanic : '';
  const requestedTarget = typeof starter?.requestedTargetPlatform === 'string' ? starter.requestedTargetPlatform : '';
  const executedTarget = typeof starter?.executedTargetPlatform === 'string' ? starter.executedTargetPlatform : '';
  const evidenceSafe = name.length > 0
    && objective.length > 0
    && mechanic.length > 0
    && requestedTarget.length > 0
    && executedTarget === 'web'
    && evidence?.build?.executed === true
    && evidence?.build?.status === 'pass'
    && evidence?.qa?.executed === true
    && evidence?.qa?.status === 'pass'
    && evidence?.releaseCandidate?.dryRunOnly === true
    && evidence?.publishing?.executed === false
    && evidence?.publishing?.secretsUsed === false
    && evidence?.destination?.kind === 'local'
    && typeof evidence?.destinationTarget === 'string'
    && evidence.destinationTarget.startsWith('local://')
    && SHA256_PATTERN.test(String(bundledArtifactSha256));
  if (!evidenceSafe) throw new Error('Starter home requires validated local dry-run project and evidence state');

  const publishingPlan = publishingPlanProjection(evidence.publishing, evidence.destinationTarget);
  const targetStatus = requestedTarget === executedTarget
    ? `${requestedTarget} · executed locally`
    : `${requestedTarget} requested · ${executedTarget} executed locally`;
  const publishingPlanBody = publishingPlan.available
    ? `<div class="publish-status">NOT PUBLISHED</div><p>The pipeline stopped at a non-executing local plan. No provider or store operation ran.</p><div class="plan-line">${escapeHtml(publishingPlan.copy)}</div><div class="publish-facts"><span>Provider <b>none</b></span><span>Store operation <b>none</b></span><span>Secrets <b>not used</b></span><span>Destination <b>${escapeHtml(evidence.destinationTarget)}</b></span></div>`
    : `<div class="publish-status">NOT PUBLISHED</div><p>${escapeHtml(publishingPlan.copy)}</p>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; media-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(name)} · Verified starter home</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0c0d0f;color:#f3f5f7}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0c0d0f}.shell{width:min(780px,100%);display:grid;gap:16px}.eyebrow{color:#9da5af;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}h1{font-size:clamp(28px,6vw,48px);line-height:1.04;margin:4px 0 8px}h2{font-size:20px;margin:4px 0 10px}p{color:#c8ced6;margin:0;line-height:1.6}.panel{border:1px solid #2c3138;background:#15171b;border-radius:14px;padding:18px}.actions{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}.action{display:grid;gap:4px;border:1px solid #39404a;border-radius:12px;padding:16px;text-decoration:none;color:#f3f5f7;background:#1b1e23}.action.primary{background:#d7ff64;color:#101214;border-color:#d7ff64}.action b{font-size:16px}.action span{font-size:12px;opacity:.78}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fact{border:1px solid #2c3138;border-radius:10px;padding:12px;background:#101216}.fact span{display:block;color:#9da5af;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.fact b{display:block;margin-top:5px;overflow-wrap:anywhere}.publishing{display:grid;gap:12px;border-color:#4a432d;background:#191711}.publish-status{display:inline-block;width:max-content;border:1px solid #665a35;border-radius:999px;padding:4px 8px;color:#ffc76b;font-size:11px;font-weight:800;letter-spacing:.06em}.plan-line{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;border:1px solid #3b3729;border-radius:9px;background:#11100d;padding:11px;color:#e8ddb9}.publish-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;color:#9da5af;font-size:12px}.publish-facts span{overflow-wrap:anywhere}.publish-facts b{color:#f3f5f7}.proof-gate{color:#e8ddb9;font-size:12px}.boundary{border-color:#4a432d;background:#1c1912;color:#e8ddb9;font-size:13px}@media(max-width:650px){.actions,.facts,.publish-facts{grid-template-columns:1fr}}
</style>
</head>
<body><main class="shell">
<section><div class="eyebrow">By JTT · verified local starter</div><h1>${escapeHtml(name)}</h1><p>${escapeHtml(objective)}</p></section>
<section class="actions" aria-label="Starter actions">
<a class="action primary" href="starter/dist/index.html"><b>Play starter</b><span>Open the exact local web artifact that passed build and QA.</span></a>
<a class="action" href="PROJECT_BRIEF.html"><b>Project brief</b><span>See intent, mechanic and target truth.</span></a>
<a class="action" href="VERIFICATION.html"><b>Verification</b><span>See evidence and artifact digest.</span></a>
</section>
<section class="panel facts"><div class="fact"><span>Reviewed mechanic</span><b>${escapeHtml(mechanic)}</b></div><div class="fact"><span>Target status</span><b>${escapeHtml(targetStatus)}</b></div><div class="fact"><span>Build + QA</span><b>executed · pass</b></div><div class="fact"><span>Publishing</span><b>not executed · local dry run</b></div><div class="fact"><span>Secrets used</span><b>no</b></div><div class="fact"><span>Artifact SHA-256</span><b>${escapeHtml(bundledArtifactSha256)}</b></div></section>
<section class="panel publishing" aria-label="Dry-run publishing plan"><div><div class="eyebrow">Dry-run publishing plan</div><h2>What would happen next</h2></div>${publishingPlanBody}<div class="proof-gate"><b>External proof gate:</b> a real provider, device, or store action requires a separately authorized workflow and its own credentialed execution evidence. This verified starter contains no such authority.</div></section>
<section class="panel boundary"><b>Evidence boundary.</b> This home page summarizes the already validated local bundle. It does not prove native desktop/mobile execution, provider or store publication, secret-backed operations, or human playability.</section>
</main></body></html>\n`;
  return Buffer.from(html, 'utf8');
}
