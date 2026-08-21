import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createProjectBriefPage } from './studio-project-brief-page.mjs';
import { createStarterHomePage } from './studio-starter-home-page.mjs';
import { createVerificationPage } from './studio-verification-page.mjs';

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
const STARTER_HOME_PATH = 'OPEN_PROJECT.html';
const PROJECT_BRIEF_PAGE_PATH = 'PROJECT_BRIEF.html';
const VERIFICATION_SUMMARY_PATH = 'VERIFICATION.txt';
const VERIFICATION_PAGE_PATH = 'VERIFICATION.html';
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const START_HERE_BYTES = Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0; url=starter/dist/index.html"><title>Open verified starter</title></head><body><p>Opening the verified local starter. <a href="starter/dist/index.html">Open it manually</a> if your browser does not continue automatically.</p></body></html>
`, 'utf8');

function pathContains(basePath, candidatePath) {
  const rest = relative(resolve(basePath), resolve(candidatePath));
  return rest === '' || (rest !== '..' && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
}

function safeArchivePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new StudioBundleError(`Unsafe archive path: ${value}`, 'PATH_CONTAINMENT');
  }
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized.split('/').includes('..')) {
    throw new StudioBundleError(`Unsafe archive path: ${value}`, 'PATH_CONTAINMENT');
  }
  return normalized;
}

function safeRelativeArtifactPath(value) {
  const normalized = safeArchivePath(value);
  if (normalized === '.' || normalized === '') {
    throw new StudioBundleError('Verified artifact path must not be the project root', 'EVIDENCE_INCOMPLETE');
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
    const archivePath = relativePath ? `${archiveRoot}/${relativePath}` : archiveRoot;
    files.push({ path: safeArchivePath(archivePath), body });
    if (files.length > MAX_FILES) throw new StudioBundleError(`Local bundle exceeds ${MAX_FILES} files`, 'BUNDLE_TOO_LARGE');
    const total = files.reduce((sum, file) => sum + file.body.length, 0);
    if (total > MAX_UNCOMPRESSED_BYTES) throw new StudioBundleError(`Local bundle exceeds ${MAX_UNCOMPRESSED_BYTES} uncompressed bytes`, 'BUNDLE_TOO_LARGE');
  }
  await visit(resolve(root), '');
  return files;
}

function parseEvidenceFile(evidenceFiles, filename) {
  const entry = evidenceFiles.find((file) => file.path === `evidence/${filename}`);
  if (!entry) throw new StudioBundleError(`Verified local starter is missing valid ${filename}`, 'EVIDENCE_INCOMPLETE');
  try {
    return JSON.parse(entry.body.toString('utf8'));
  } catch {
    throw new StudioBundleError(`Verified local starter is missing valid ${filename}`, 'EVIDENCE_INCOMPLETE');
  }
}

function assertEvidenceContract(evidenceFiles) {
  const build = parseEvidenceFile(evidenceFiles, 'build-result.json');
  const qa = parseEvidenceFile(evidenceFiles, 'qa-result.json');
  const releaseCandidate = parseEvidenceFile(evidenceFiles, 'release-candidate.json');
  const publishing = parseEvidenceFile(evidenceFiles, 'publishing-receipt.json');
  const destination = publishing?.destination;
  const destinationTarget = typeof destination?.target === 'string' ? destination.target : '';
  const artifactPaths = [build?.artifactPath, qa?.artifactPath, releaseCandidate?.build?.artifactPath];
  const artifactHashes = [build?.artifactSha256, qa?.artifactSha256, releaseCandidate?.build?.outputSha256];
  const evidenceSafe = build?.executed === true
    && build?.status === 'pass'
    && qa?.executed === true
    && qa?.status === 'pass'
    && releaseCandidate?.dryRunOnly === true
    && publishing?.executed === false
    && publishing?.secretsUsed === false
    && destination?.kind === 'local'
    && destinationTarget.startsWith('local://')
    && artifactPaths.every((value) => typeof value === 'string' && value.length > 0)
    && artifactPaths.every((value) => value === artifactPaths[0])
    && artifactHashes.every((value) => typeof value === 'string' && SHA256_PATTERN.test(value))
    && artifactHashes.every((value) => value === artifactHashes[0]);
  if (!evidenceSafe) {
    throw new StudioBundleError('Verified local starter evidence does not satisfy the local dry-run artifact contract', 'EVIDENCE_INCOMPLETE');
  }
  return {
    build,
    qa,
    releaseCandidate,
    publishing,
    destination,
    destinationTarget,
    artifactPath: safeRelativeArtifactPath(artifactPaths[0]),
    evidenceArtifactSha256: artifactHashes[0]
  };
}

async function snapshotVerifiedArtifact(projectDir, artifactPath) {
  const project = resolve(projectDir);
  const absoluteArtifact = resolve(project, artifactPath);
  if (!pathContains(project, absoluteArtifact) || absoluteArtifact === project) {
    throw new StudioBundleError('Verified artifact path escaped the project', 'EVIDENCE_INCOMPLETE');
  }
  let rootStat;
  try {
    rootStat = await lstat(absoluteArtifact);
  } catch {
    throw new StudioBundleError('Verified artifact is no longer available for packaging', 'EVIDENCE_INCOMPLETE');
  }
  const files = [];
  const hash = createHash('sha256');
  const archiveRoot = safeArchivePath(`starter/${artifactPath}`);
  async function visit(current, hashRelativePath, archiveRelativePath) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new StudioBundleError(`Verified artifact contains a symbolic link: ${archiveRelativePath || '.'}`, 'EVIDENCE_INCOMPLETE');
    if (stat.isDirectory()) {
      hash.update(`directory\0${hashRelativePath}\0`);
      const names = (await readdir(current)).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
      for (const name of names) {
        const nextHashPath = hashRelativePath ? `${hashRelativePath}/${name}` : name;
        const nextArchivePath = archiveRelativePath ? `${archiveRelativePath}/${name}` : name;
        await visit(resolve(current, name), nextHashPath, nextArchivePath);
      }
      return;
    }
    if (!stat.isFile()) throw new StudioBundleError(`Verified artifact contains an unsupported entry: ${archiveRelativePath || '.'}`, 'EVIDENCE_INCOMPLETE');
    const body = await readFile(current);
    hash.update(`file\0${hashRelativePath}\0${stat.size}\0`);
    hash.update(body);
    files.push({ path: safeArchivePath(rootStat.isDirectory() ? `${archiveRoot}/${archiveRelativePath}` : archiveRoot), body });
  }
  await visit(absoluteArtifact, rootStat.isDirectory() ? '' : 'artifact', rootStat.isDirectory() ? '' : 'artifact');
  return { absoluteArtifact, files, sha256: `sha256:${hash.digest('hex')}` };
}

function createVerificationSummary(evidence, bundledArtifactSha256) {
  const { build, qa, releaseCandidate, publishing, destination, destinationTarget } = evidence;
  const lines = [
    'BYJTT VERIFIED LOCAL STARTER',
    '',
    'This is a portable summary of the machine-readable records in evidence/.',
    'It is bound to the artifact bytes packaged in this archive by the SHA-256 shown below.',
    'It does not claim store/provider publication, secret-backed execution, real requested-device execution, or human playability.',
    '',
    `Build executed: ${build.executed}`,
    `Build status: ${build.status}`,
    `Build artifact SHA-256: ${build.artifactSha256}`,
    `QA executed: ${qa.executed}`,
    `QA status: ${qa.status}`,
    `QA artifact SHA-256: ${qa.artifactSha256}`,
    `Release candidate artifact SHA-256: ${releaseCandidate.build.outputSha256}`,
    `Bundled artifact SHA-256: ${bundledArtifactSha256}`,
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

async function createPortableProjectBrief(project) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(resolve(project, 'project.manifest.json'), 'utf8'));
    const page = createProjectBriefPage(manifest);
    return { manifest, page };
  } catch (error) {
    throw new StudioBundleError(`Verified local starter is missing a valid portable project brief: ${error.message}`, 'BRIEF_INCOMPLETE');
  }
}

export async function createStudioBundle({ projectDir, outputDir, projectId = 'starter' }) {
  const project = resolve(projectDir);
  const output = resolve(outputDir);
  const evidenceFiles = await collectFiles(output, 'evidence');
  const evidence = assertEvidenceContract(evidenceFiles);
  const artifactSnapshot = await snapshotVerifiedArtifact(project, evidence.artifactPath);
  if (artifactSnapshot.sha256 !== evidence.evidenceArtifactSha256) {
    throw new StudioBundleError('Verified artifact bytes no longer match build, QA, and release-candidate evidence', 'EVIDENCE_INCOMPLETE');
  }
  const projectFiles = await collectFiles(project, 'starter', {
    excludeNames: EXCLUDED_PROJECT_NAMES,
    excludePaths: [artifactSnapshot.absoluteArtifact, ...(pathContains(project, output) ? [output] : [])]
  });
  const allProjectFiles = [...projectFiles, ...artifactSnapshot.files];
  if (!allProjectFiles.some((file) => file.path === VERIFIED_PLAYABLE_PATH)) {
    throw new StudioBundleError('Verified local starter is missing dist/index.html', 'PLAYABLE_MISSING');
  }
  const { manifest, page: projectBriefPage } = await createPortableProjectBrief(project);
  const verificationSummary = createVerificationSummary(evidence, artifactSnapshot.sha256);
  const verificationPage = createVerificationPage(evidence, artifactSnapshot.sha256);
  let starterHomePage;
  try {
    starterHomePage = createStarterHomePage(manifest, evidence, artifactSnapshot.sha256);
  } catch (error) {
    throw new StudioBundleError(`Verified local starter could not create its project home: ${error.message}`, 'EVIDENCE_INCOMPLETE');
  }
  const files = [
    { path: START_HERE_PATH, body: START_HERE_BYTES },
    { path: STARTER_HOME_PATH, body: starterHomePage },
    { path: PROJECT_BRIEF_PAGE_PATH, body: projectBriefPage },
    { path: VERIFICATION_PAGE_PATH, body: verificationPage },
    { path: VERIFICATION_SUMMARY_PATH, body: verificationSummary },
    ...allProjectFiles,
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