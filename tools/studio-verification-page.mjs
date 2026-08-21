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

export function releaseCandidateProjection(evidence) {
  const candidate = evidence?.releaseCandidate;
  const safetyDestination = evidence?.destination;
  const destinationTarget = evidence?.destinationTarget;
  const candidateId = candidate?.candidateId;
  const candidateDestination = candidate?.destination;
  const artifactPath = candidate?.build?.artifactPath;
  const outputSha256 = candidate?.build?.outputSha256;

  const valid = typeof candidateId === 'string'
    && candidateId.length > 0
    && candidateId.length <= 160
    && !CONTROL_CHARACTER_PATTERN.test(candidateId)
    && candidate?.dryRunOnly === true
    && safetyDestination?.kind === 'local'
    && typeof destinationTarget === 'string'
    && destinationTarget.startsWith('local://')
    && candidateDestination?.kind === 'local'
    && candidateDestination?.target === destinationTarget
    && typeof artifactPath === 'string'
    && artifactPath.length > 0
    && artifactPath.length <= 512
    && !CONTROL_CHARACTER_PATTERN.test(artifactPath)
    && SHA256_PATTERN.test(outputSha256 || '');

  if (!valid) throw new Error('Release candidate evidence is incomplete or contradicts the verified local dry-run boundary.');

  return {
    candidateId,
    artifactPath,
    outputSha256,
    destinationTarget,
    dryRunOnly: true
  };
}

export function createVerificationPage(evidence, bundledArtifactSha256) {
  const { build, qa, publishing, destination, destinationTarget } = evidence;
  const releaseCandidate = releaseCandidateProjection(evidence);
  const facts = [
    fact('Build', `${build.status} · executed`, 'pass'),
    fact('QA', `${qa.status} · executed`, 'pass'),
    fact('Release candidate ID', releaseCandidate.candidateId, 'safe'),
    fact('Release candidate', 'dry-run only', 'safe'),
    fact('Candidate artifact', releaseCandidate.artifactPath),
    fact('Candidate destination', releaseCandidate.destinationTarget),
    fact('Publication', publishing.executed ? 'executed' : 'not executed', publishing.executed ? 'warn' : 'safe'),
    fact('Secrets', publishing.secretsUsed ? 'used' : 'not used', publishing.secretsUsed ? 'warn' : 'safe'),
    fact('Destination', `${destination.kind} · ${destinationTarget}`),
    fact('Verified artifact SHA-256', bundledArtifactSha256),
    fact('Build artifact SHA-256', build.artifactSha256),
    fact('QA artifact SHA-256', qa.artifactSha256),
    fact('Release candidate SHA-256', releaseCandidate.outputSha256)
  ].join('');

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
    <div class="boundary"><strong>Evidence boundary:</strong> this release candidate is local and dry-run only. It does not claim store/provider publication, secret-backed execution, real requested-device execution, or human playability.</div>
    <p class="foot">For full provenance, inspect the JSON records under <code>evidence/</code>. This page contains no scripts and its Content Security Policy blocks network resources.</p>
  </main>
</body>
</html>
`, 'utf8');
}
