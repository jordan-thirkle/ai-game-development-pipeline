import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

export class StudioBundleError extends Error {
  constructor(message, code = 'STUDIO_BUNDLE_ERROR') {
    super(message);
    this.name = 'StudioBundleError';
    this.code = code;
  }
}

const MAX_FILES = 256;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const EXCLUDED_PROJECT_NAMES = new Set(['.git', 'node_modules']);
const VERIFIED_PLAYABLE_PATH = 'starter/dist/index.html';
const START_HERE_PATH = 'START_HERE.html';
const VERIFICATION_SUMMARY_PATH = 'VERIFICATION.txt';
const START_HERE_BYTES = Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0; url=starter/dist/index.html"><title>Open verified starter</title></head><body><p>Opening the verified local starter. <a href="starter/dist/index.html">Open it manually</a> if your browser does not continue automatically.</p></body></html>
`, 'utf8');

function pathContains(basePath, candidatePath) {
  const rest = relative(resolve(basePath), resolve(candidatePath));
  return rest === '' || (rest !== '..' && !rest.startsWith(`..${sep}`));
}

function safeArchivePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new StudioBundleError(`Unsafe archive path: ${value}`, 'PATH_CONTAINMENT');
  }
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new StudioBundleError(`Unsafe archive path: ${value}`, 'PATH_CONTAINMENT');
  }
  return normalized;
}

function writeOctal(buffer, offset, length, value) {
  const encoded = Math.max(0, value).toString(8).padStart(length - 1, '0').slice(-(length - 1));
  buffer.write(encoded, offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function tarHeader(name, size) {
  const path = safeArchivePath(name);
  if (Buffer.byteLength(path) > 100) throw new StudioBundleError(`Archive path is too long: ${path}`, 'PATH_TOO_LONG');
  const header = Buffer.alloc(512, 0);
  header.write(path, 0, 100, 'utf8');
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const checksumText = checksum.toString(8).padStart(6, '0').slice(-6);
  header.write(checksumText, 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

async function collectFiles(root, archiveRoot, { excludeNames = new Set(), excludePaths = [] } = {}) {
  const files = [];
  async function visit(current, relativePath) {
    if (excludePaths.some((excluded) => pathContains(excluded, current))) return;
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new StudioBundleError(`Refusing symbolic link in local bundle: ${relativePath || '.'}`, 'SYMLINK_REFUSED');
    if (stat.isDirectory()) {
      const names = (await readdir(current)).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
      for (const name of names) {
        if (excludeNames.has(name)) continue;
        await visit(resolve(current, name), relativePath ? `${relativePath}/${name}` : name);
      }
      return;
    }
    if (!stat.isFile()) throw new StudioBundleError(`Unsupported filesystem entry in local bundle: ${relativePath}`, 'UNSUPPORTED_ENTRY');
    const body = await readFile(current);
    files.push({ path: safeArchivePath(`${archiveRoot}/${relativePath}`), body });
    if (files.length > MAX_FILES) throw new StudioBundleError(`Local bundle exceeds ${MAX_FILES} files`, 'BUNDLE_TOO_LARGE');
    const total = files.reduce((sum, file) => sum + file.body.length, 0);
    if (total > MAX_UNCOMPRESSED_BYTES) throw new StudioBundleError(`Local bundle exceeds ${MAX_UNCOMPRESSED_BYTES} uncompressed bytes`, 'BUNDLE_TOO_LARGE');
  }
  await visit(resolve(root), '');
  return files;
}

async function readJsonEvidence(outputDir, filename) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(resolve(outputDir, filename), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) {
      throw new StudioBundleError(`Verified local starter is missing valid ${filename}`, 'EVIDENCE_INCOMPLETE');
    }
    throw error;
  }
  return parsed;
}

async function createVerificationSummary(outputDir) {
  const [build, qa, releaseCandidate, publishing] = await Promise.all([
    readJsonEvidence(outputDir, 'build-result.json'),
    readJsonEvidence(outputDir, 'qa-result.json'),
    readJsonEvidence(outputDir, 'release-candidate.json'),
    readJsonEvidence(outputDir, 'publishing-receipt.json')
  ]);
  const destination = publishing?.destination;
  const destinationTarget = typeof destination?.target === 'string' ? destination.target : '';
  const safe = build?.executed === true
    && build?.status === 'pass'
    && qa?.executed === true
    && qa?.status === 'pass'
    && releaseCandidate?.dryRunOnly === true
    && publishing?.executed === false
    && publishing?.secretsUsed === false
    && destination?.kind === 'local'
    && destinationTarget.startsWith('local://');
  if (!safe) {
    throw new StudioBundleError('Verified local starter evidence does not satisfy the local dry-run safety contract', 'EVIDENCE_INCOMPLETE');
  }
  const lines = [
    'BYJTT VERIFIED LOCAL STARTER',
    '',
    'This is a portable summary of the machine-readable records in evidence/.',
    'It does not claim store/provider publication, secret-backed execution, real requested-device execution, or human playability.',
    '',
    `Build executed: ${build.executed}`,
    `Build status: ${build.status}`,
    `Build artifact SHA-256: ${build.artifactSha256 || 'not recorded'}`,
    `QA executed: ${qa.executed}`,
    `QA status: ${qa.status}`,
    `QA artifact SHA-256: ${qa.artifactSha256 || 'not recorded'}`,
    `Release candidate dry-run only: ${releaseCandidate.dryRunOnly}`,
    `Publication executed: ${publishing.executed}`,
    `Secrets used: ${publishing.secretsUsed}`,
    `Destination kind: ${destination.kind}`,
    `Destination: ${destinationTarget}`,
    '',
    'For full provenance, inspect the JSON files under evidence/.',
    ''
  ];
  return Buffer.from(lines.join('\n'), 'utf8');
}

export async function createStudioBundle({ projectDir, outputDir, projectId = 'starter' }) {
  const project = resolve(projectDir);
  const output = resolve(outputDir);
  const projectFiles = await collectFiles(project, 'starter', {
    excludeNames: EXCLUDED_PROJECT_NAMES,
    excludePaths: pathContains(project, output) ? [output] : []
  });
  const evidenceFiles = await collectFiles(output, 'evidence');
  if (!projectFiles.some((file) => file.path === VERIFIED_PLAYABLE_PATH)) {
    throw new StudioBundleError('Verified local starter is missing dist/index.html', 'PLAYABLE_MISSING');
  }
  const verificationSummary = await createVerificationSummary(output);
  const files = [
    { path: START_HERE_PATH, body: START_HERE_BYTES },
    { path: VERIFICATION_SUMMARY_PATH, body: verificationSummary },
    ...projectFiles,
    ...evidenceFiles
  ].sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)));
  if (files.length === 0) throw new StudioBundleError('Local bundle would be empty', 'EMPTY_BUNDLE');
  if (files.length > MAX_FILES) throw new StudioBundleError(`Local bundle exceeds ${MAX_FILES} files`, 'BUNDLE_TOO_LARGE');
  const totalBytes = files.reduce((sum, file) => sum + file.body.length, 0);
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) throw new StudioBundleError(`Local bundle exceeds ${MAX_UNCOMPRESSED_BYTES} uncompressed bytes`, 'BUNDLE_TOO_LARGE');

  const chunks = [];
  for (const file of files) {
    chunks.push(tarHeader(file.path, file.body.length), file.body);
    const padding = (512 - (file.body.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  const bytes = gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
  const safeProjectId = String(projectId).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'starter';
  return {
    bytes,
    filename: `${safeProjectId}-verified-local-starter.tar.gz`,
    contentType: 'application/gzip',
    sizeBytes: bytes.length,
    fileCount: files.length,
    uncompressedBytes: totalBytes,
    sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  };
}
