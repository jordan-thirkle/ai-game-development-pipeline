const TAR_BLOCK_BYTES = 512;
const STARTER_BUNDLE_MAX_COMPRESSED_BYTES = 10 * 1024 * 1024;
const STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES = 9 * 1024 * 1024;
const STARTER_BUNDLE_MAX_ENTRIES = 256;
const STARTER_MANIFEST_MAX_BYTES = 64 * 1024;
const STARTER_EVIDENCE_MAX_BYTES = 256 * 1024;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const REQUIRED_EVIDENCE_FILES = Object.freeze([
  'evidence/build-result.json',
  'evidence/qa-result.json',
  'evidence/release-candidate.json',
  'evidence/publishing-receipt.json'
]);

function ascii(bytes, start, length) {
  let end = start;
  const limit = Math.min(bytes.length, start + length);
  while (end < limit && bytes[end] !== 0) end += 1;
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start, end));
}

function parseOctal(bytes, start, length, label) {
  const raw = ascii(bytes, start, length).trim().replace(/\0/g, '');
  if (!raw) return 0;
  if (!/^[0-7]+$/.test(raw)) throw new Error(`Starter bundle has an invalid ${label}.`);
  const value = Number.parseInt(raw, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Starter bundle has an invalid ${label}.`);
  return value;
}

function validateTarPath(path) {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw new Error('Starter bundle contains an unsafe archive path.');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) throw new Error('Starter bundle contains an unsafe archive path.');
  return segments.join('/');
}

function checksum(header) {
  let sum = 0;
  for (let index = 0; index < header.length; index += 1) sum += index >= 148 && index < 156 ? 32 : header[index];
  return sum;
}

function allZero(bytes) {
  for (const value of bytes) if (value !== 0) return false;
  return true;
}

function parsePortableStarterTarEntries(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
  if (bytes.byteLength === 0 || bytes.byteLength > STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES) throw new Error('Starter bundle is empty or exceeds the safe uncompressed size limit.');

  let offset = 0;
  let entryCount = 0;
  let terminated = false;
  const entries = new Map();
  while (offset < bytes.byteLength) {
    if (offset + TAR_BLOCK_BYTES > bytes.byteLength) throw new Error('Starter bundle is truncated.');
    const header = bytes.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (allZero(header)) {
      const secondTerminatorEnd = offset + (2 * TAR_BLOCK_BYTES);
      if (secondTerminatorEnd > bytes.byteLength) throw new Error('Starter bundle is missing the required two-block tar terminator.');
      const secondTerminator = bytes.subarray(offset + TAR_BLOCK_BYTES, secondTerminatorEnd);
      if (!allZero(secondTerminator)) throw new Error('Starter bundle has a malformed tar terminator.');
      const trailing = bytes.subarray(secondTerminatorEnd);
      if (trailing.byteLength % TAR_BLOCK_BYTES !== 0 || !allZero(trailing)) throw new Error('Starter bundle contains invalid trailing data after the tar terminator.');
      terminated = true;
      break;
    }

    entryCount += 1;
    if (entryCount > STARTER_BUNDLE_MAX_ENTRIES) throw new Error(`Starter bundle must contain no more than ${STARTER_BUNDLE_MAX_ENTRIES} entries.`);

    const expectedChecksum = parseOctal(header, 148, 8, 'tar checksum');
    if (checksum(header) !== expectedChecksum) throw new Error('Starter bundle tar checksum is invalid.');
    const name = ascii(header, 0, 100);
    const prefix = ascii(header, 345, 155);
    const path = validateTarPath(prefix ? `${prefix}/${name}` : name);
    if (entries.has(path)) throw new Error(`Starter bundle contains a duplicate archive path: ${path}.`);
    const size = parseOctal(header, 124, 12, 'entry size');
    const type = header[156];
    if (![0, 48, 53].includes(type)) throw new Error('Starter bundle contains an unsupported archive entry type.');
    if (type === 53 && size !== 0) throw new Error('Starter bundle contains a malformed directory entry.');

    const contentStart = offset + TAR_BLOCK_BYTES;
    const contentEnd = contentStart + size;
    const recordEnd = contentStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (contentEnd > bytes.byteLength || recordEnd > bytes.byteLength) throw new Error('Starter bundle is truncated.');
    entries.set(path, {
      path,
      type,
      size,
      bytes: bytes.subarray(contentStart, contentEnd)
    });
    offset = recordEnd;
  }

  if (!terminated) throw new Error('Starter bundle is missing the required two-block tar terminator.');
  return entries;
}

function regularEntry(entries, path, label, maxBytes) {
  const entry = entries.get(path);
  if (!entry || ![0, 48].includes(entry.type)) throw new Error(`Starter bundle is missing valid ${label}.`);
  if (entry.size <= 0 || entry.size > maxBytes) throw new Error(`${label} must be between 1 byte and ${maxBytes} bytes.`);
  return entry;
}

function manifestTextFromEntries(entries) {
  const entry = regularEntry(entries, 'starter/project.manifest.json', 'starter/project.manifest.json', STARTER_MANIFEST_MAX_BYTES);
  return new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes);
}

function evidenceJson(entries, path) {
  const entry = regularEntry(entries, path, path, STARTER_EVIDENCE_MAX_BYTES);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes));
  } catch {
    throw new Error(`Starter bundle is missing valid ${path}.`);
  }
}

function safeArtifactPath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Starter bundle evidence is missing the verified artifact path.');
  const normalized = validateTarPath(value.trim());
  if (normalized.startsWith('starter/') || normalized.startsWith('evidence/')) throw new Error('Starter bundle evidence contains an unsafe verified artifact path.');
  return normalized;
}

function compareUtf8(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

function artifactHashChunksForDirectory(entries, archiveRoot) {
  const rootPrefix = `${archiveRoot}/`;
  const files = [];
  for (const entry of entries.values()) {
    if (![0, 48].includes(entry.type) || !entry.path.startsWith(rootPrefix)) continue;
    const relative = entry.path.slice(rootPrefix.length);
    if (!relative) continue;
    files.push({ relative, entry });
  }
  if (files.length === 0) throw new Error('Starter bundle is missing the verified artifact bytes.');

  const tree = { directories: new Map(), files: new Map() };
  for (const file of files) {
    const segments = file.relative.split('/');
    let node = tree;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      if (node.files.has(segment)) throw new Error('Starter bundle artifact paths are ambiguous.');
      if (!node.directories.has(segment)) node.directories.set(segment, { directories: new Map(), files: new Map() });
      node = node.directories.get(segment);
    }
    const leaf = segments.at(-1);
    if (node.directories.has(leaf) || node.files.has(leaf)) throw new Error('Starter bundle artifact paths are ambiguous.');
    node.files.set(leaf, file.entry);
  }

  const encoder = new TextEncoder();
  const chunks = [encoder.encode('directory\0\0')];
  function visit(node, prefix) {
    const names = [...node.directories.keys(), ...node.files.keys()].sort(compareUtf8);
    for (const name of names) {
      const relative = prefix ? `${prefix}/${name}` : name;
      if (node.directories.has(name)) {
        chunks.push(encoder.encode(`directory\0${relative}\0`));
        visit(node.directories.get(name), relative);
      } else {
        const entry = node.files.get(name);
        chunks.push(encoder.encode(`file\0${relative}\0${entry.size}\0`), entry.bytes);
      }
    }
  }
  visit(tree, '');
  return chunks;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function verifiedArtifactSha256(entries, artifactPath) {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot safely verify starter artifact SHA-256; use the extracted-folder fallback instead.');
  const archiveRoot = `starter/${artifactPath}`;
  const direct = entries.get(archiveRoot);
  let chunks;
  if (direct && [0, 48].includes(direct.type)) {
    const encoder = new TextEncoder();
    chunks = [encoder.encode(`file\0artifact\0${direct.size}\0`), direct.bytes];
  } else {
    chunks = artifactHashChunksForDirectory(entries, archiveRoot);
  }
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', concatBytes(chunks)));
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

function assertVerificationEvidence(entries) {
  for (const path of REQUIRED_EVIDENCE_FILES) regularEntry(entries, path, path, STARTER_EVIDENCE_MAX_BYTES);
  const build = evidenceJson(entries, 'evidence/build-result.json');
  const qa = evidenceJson(entries, 'evidence/qa-result.json');
  const releaseCandidate = evidenceJson(entries, 'evidence/release-candidate.json');
  const publishing = evidenceJson(entries, 'evidence/publishing-receipt.json');
  const artifactPaths = [build?.artifactPath, qa?.artifactPath, releaseCandidate?.build?.artifactPath].map(safeArtifactPath);
  const artifactHashes = [build?.artifactSha256, qa?.artifactSha256, releaseCandidate?.build?.outputSha256];
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
    && destinationTarget.startsWith('local://')
    && artifactPaths.every((value) => value === artifactPaths[0])
    && artifactHashes.every((value) => typeof value === 'string' && SHA256_PATTERN.test(value))
    && artifactHashes.every((value) => value === artifactHashes[0]);
  if (!safe) throw new Error('Starter bundle evidence does not satisfy the verified local dry-run contract.');
  return {
    artifactPath: artifactPaths[0],
    artifactSha256: artifactHashes[0],
    destination: destinationTarget,
    buildStatus: 'executed-pass',
    qaStatus: 'executed-pass',
    releaseCandidateStatus: 'dry-run-only',
    publicationStatus: 'not-executed',
    secretsStatus: 'not-used'
  };
}

export function portableStarterManifestTextFromTarBytes(value) {
  return manifestTextFromEntries(parsePortableStarterTarEntries(value));
}

export async function verifiedPortableStarterImportFromTarBytes(value) {
  const entries = parsePortableStarterTarEntries(value);
  const manifestText = manifestTextFromEntries(entries);
  const verification = assertVerificationEvidence(entries);
  const artifactSha256 = await verifiedArtifactSha256(entries, verification.artifactPath);
  if (artifactSha256 !== verification.artifactSha256) throw new Error('Starter bundle artifact bytes do not match the build, QA, and release-candidate evidence.');
  return Object.freeze({ manifestText, verification: Object.freeze({ ...verification }) });
}

export async function verifiedPortableStarterManifestTextFromTarBytes(value) {
  return (await verifiedPortableStarterImportFromTarBytes(value)).manifestText;
}

async function readBoundedStream(stream, maxBytes) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Starter bundle exceeds the safe uncompressed size limit.');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function decompressedPortableStarterBytes(file) {
  if (!file || typeof file.stream !== 'function') throw new Error('Choose a verified starter .tar.gz bundle.');
  if (file.size <= 0 || file.size > STARTER_BUNDLE_MAX_COMPRESSED_BYTES) throw new Error(`Starter bundle must be between 1 byte and ${STARTER_BUNDLE_MAX_COMPRESSED_BYTES} bytes compressed.`);
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot safely open gzip starter bundles; use the extracted-folder fallback instead.');
  let stream;
  try {
    stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
  } catch {
    throw new Error('Starter bundle must be a valid gzip archive.');
  }
  try {
    return await readBoundedStream(stream, STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES);
  } catch (error) {
    if (/safe uncompressed size limit/i.test(error.message)) throw error;
    throw new Error('Starter bundle could not be decompressed safely.');
  }
}

export async function verifiedPortableStarterImportFromBundleFile(file) {
  return verifiedPortableStarterImportFromTarBytes(await decompressedPortableStarterBytes(file));
}

export async function portableStarterManifestTextFromBundleFile(file) {
  return (await verifiedPortableStarterImportFromBundleFile(file)).manifestText;
}

export const portableStarterBundleLimits = Object.freeze({
  compressedBytes: STARTER_BUNDLE_MAX_COMPRESSED_BYTES,
  uncompressedBytes: STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES,
  entries: STARTER_BUNDLE_MAX_ENTRIES,
  manifestBytes: STARTER_MANIFEST_MAX_BYTES,
  evidenceBytes: STARTER_EVIDENCE_MAX_BYTES
});
