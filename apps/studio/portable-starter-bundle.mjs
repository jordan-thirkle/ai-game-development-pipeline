const TAR_BLOCK_BYTES = 512;
const STARTER_BUNDLE_MAX_COMPRESSED_BYTES = 10 * 1024 * 1024;
const STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES = 9 * 1024 * 1024;
const STARTER_BUNDLE_MAX_ENTRIES = 256;
const STARTER_MANIFEST_MAX_BYTES = 64 * 1024;

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

export function portableStarterManifestTextFromTarBytes(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
  if (bytes.byteLength === 0 || bytes.byteLength > STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES) throw new Error('Starter bundle is empty or exceeds the safe uncompressed size limit.');

  let offset = 0;
  let entries = 0;
  let manifestText = null;
  while (offset + TAR_BLOCK_BYTES <= bytes.byteLength) {
    const header = bytes.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (allZero(header)) break;
    entries += 1;
    if (entries > STARTER_BUNDLE_MAX_ENTRIES) throw new Error(`Starter bundle must contain no more than ${STARTER_BUNDLE_MAX_ENTRIES} entries.`);

    const expectedChecksum = parseOctal(header, 148, 8, 'tar checksum');
    if (checksum(header) !== expectedChecksum) throw new Error('Starter bundle tar checksum is invalid.');
    const name = ascii(header, 0, 100);
    const prefix = ascii(header, 345, 155);
    const path = validateTarPath(prefix ? `${prefix}/${name}` : name);
    const size = parseOctal(header, 124, 12, 'entry size');
    const type = header[156];
    if (![0, 48, 53].includes(type)) throw new Error('Starter bundle contains an unsupported archive entry type.');
    if (type === 53 && size !== 0) throw new Error('Starter bundle contains a malformed directory entry.');

    const contentStart = offset + TAR_BLOCK_BYTES;
    const contentEnd = contentStart + size;
    if (contentEnd > bytes.byteLength) throw new Error('Starter bundle is truncated.');
    if (/(^|\/)starter\/project\.manifest\.json$/.test(path)) {
      if (![0, 48].includes(type)) throw new Error('Starter manifest must be a regular file.');
      if (manifestText !== null) throw new Error('Starter bundle contains more than one starter/project.manifest.json and is ambiguous.');
      if (size <= 0 || size > STARTER_MANIFEST_MAX_BYTES) throw new Error(`Starter manifest must be between 1 byte and ${STARTER_MANIFEST_MAX_BYTES} bytes.`);
      manifestText = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(contentStart, contentEnd));
    }
    offset = contentStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
  }
  if (manifestText === null) throw new Error('Starter bundle must contain exactly one starter/project.manifest.json.');
  return manifestText;
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

export async function portableStarterManifestTextFromBundleFile(file) {
  if (!file || typeof file.stream !== 'function') throw new Error('Choose a verified starter .tar.gz bundle.');
  if (file.size <= 0 || file.size > STARTER_BUNDLE_MAX_COMPRESSED_BYTES) throw new Error(`Starter bundle must be between 1 byte and ${STARTER_BUNDLE_MAX_COMPRESSED_BYTES} bytes compressed.`);
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot safely open gzip starter bundles; use the extracted-folder fallback instead.');
  let stream;
  try {
    stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
  } catch {
    throw new Error('Starter bundle must be a valid gzip archive.');
  }
  let bytes;
  try {
    bytes = await readBoundedStream(stream, STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES);
  } catch (error) {
    if (/safe uncompressed size limit/i.test(error.message)) throw error;
    throw new Error('Starter bundle could not be decompressed safely.');
  }
  return portableStarterManifestTextFromTarBytes(bytes);
}

export const portableStarterBundleLimits = Object.freeze({
  compressedBytes: STARTER_BUNDLE_MAX_COMPRESSED_BYTES,
  uncompressedBytes: STARTER_BUNDLE_MAX_UNCOMPRESSED_BYTES,
  entries: STARTER_BUNDLE_MAX_ENTRIES,
  manifestBytes: STARTER_MANIFEST_MAX_BYTES
});
