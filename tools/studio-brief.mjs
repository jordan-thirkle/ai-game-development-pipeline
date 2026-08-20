import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ALLOWED_FIELDS = new Set(['name', 'objective', 'targetPlatform']);
const TARGETS = new Set(['web', 'desktop', 'mobile']);

export class BriefError extends Error {
  constructor(message, code = 'INVALID_BRIEF') {
    super(message);
    this.name = 'BriefError';
    this.code = code;
  }
}

function cleanText(value, label, maxLength) {
  if (typeof value !== 'string') throw new BriefError(`${label} must be text`);
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) throw new BriefError(`${label} is required`);
  if (text.length > maxLength) throw new BriefError(`${label} must be ${maxLength} characters or fewer`);
  if(/[\u0000-\u001f\u007f]/.test(text)) throw new BriefError(`${label} contains unsupported control characters`);
  return text;
}

function slug(value) {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const safe = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42).replace(/-+$/g, '');
  return safe || 'local-starter';
}

export function normalizeStudioBrief(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BriefError('Brief must be a JSON object');
  for (const key of Object.keys(value)) if (!ALLOWED_FIELDS.has(key)) throw new BriefError(`Unsupported brief field: ${key}`);
  const name = cleanText(value.name, 'name', 80);
  const objective = cleanText(value.objective, 'objective', 500);
  const targetPlatform = cleanText(value.targetPlatform, 'targetPlatform', 20).toLowerCase();
  if (!TARGETS.has(targetPlatform)) throw new BriefError('targetPlatform must be web, desktop, or mobile');
  return { name, objective, targetPlatform, projectId: `brief-${slug(name)}` };
}

export async function applyStudioBrief(projectDir, value) {
  const brief = normalizeStudioBrief(value);
  const manifestPath = resolve(projectDir, 'project.manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.projectId = brief.projectId;
  manifest.name = brief.name;
  manifest.objective = brief.objective;
  manifest.targetPlatforms = [brief.targetPlatform];
  manifest.publish = { provider: 'local', destination: `local://planned/${brief.projectId}` };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return brief;
}
