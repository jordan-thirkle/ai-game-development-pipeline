import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  portableStarterBundleLimits,
  portableStarterManifestTextFromTarBytes,
  verifiedPortableStarterImportFromTarBytes,
  verifiedPortableStarterManifestTextFromTarBytes
} from '../apps/studio/portable-starter-bundle.mjs';
import { parsePortableStarterBriefText } from '../apps/studio/failed-run-retry.mjs';

const manifestText = await readFile(new URL('../examples/sample-game/project.manifest.json', import.meta.url), 'utf8');

function octal(value, width) {
  return `${value.toString(8).padStart(width - 1, '0')}\0`;
}

function tarEntry(name, body = '', type = '0') {
  const encoder = new TextEncoder();
  const content = typeof body === 'string' ? encoder.encode(body) : body;
  const header = new Uint8Array(512);
  const write = (offset, width, text) => header.set(encoder.encode(text).subarray(0, width), offset);
  write(0, 100, name);
  write(100, 8, octal(0o644, 8));
  write(108, 8, octal(0, 8));
  write(116, 8, octal(0, 8));
  write(124, 12, octal(content.byteLength, 12));
  write(136, 12, octal(0, 12));
  for (let index = 148; index < 156; index += 1) header[index] = 32;
  header[156] = type.charCodeAt(0);
  write(257, 6, 'ustar\0');
  write(263, 2, '00');
  let sum = 0;
  for (const value of header) sum += value;
  write(148, 8, `${sum.toString(8).padStart(6, '0')}\0 `);
  const padded = Math.ceil(content.byteLength / 512) * 512;
  const result = new Uint8Array(512 + padded);
  result.set(header, 0);
  result.set(content, 512);
  return result;
}

function concat(...parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function tar(entries) {
  return concat(...entries, new Uint8Array(1024));
}

function artifactSha256(indexBody) {
  const body = Buffer.from(indexBody, 'utf8');
  const hash = createHash('sha256');
  hash.update('directory\0\0');
  hash.update(`file\0index.html\0${body.length}\0`);
  hash.update(body);
  return `sha256:${hash.digest('hex')}`;
}

function verifiedArchive({
  indexBody = '<!doctype html><title>playable</title>',
  build = {},
  qa = {},
  release = {},
  publishing = {},
  includeEvidence = true
} = {}) {
  const digest = artifactSha256(indexBody);
  const baseBuild = { executed: true, status: 'pass', artifactPath: 'dist', artifactSha256: digest };
  const baseQa = { executed: true, status: 'pass', artifactPath: 'dist', artifactSha256: digest };
  const baseRelease = { dryRunOnly: true, build: { artifactPath: 'dist', outputSha256: digest } };
  const basePublishing = { executed: false, secretsUsed: false, destination: { kind: 'local', target: 'local://planned/sample-game' } };
  const entries = [
    tarEntry('starter/project.manifest.json', manifestText),
    tarEntry('starter/dist/index.html', indexBody)
  ];
  if (includeEvidence) {
    entries.push(
      tarEntry('evidence/build-result.json', JSON.stringify({ ...baseBuild, ...build })),
      tarEntry('evidence/qa-result.json', JSON.stringify({ ...baseQa, ...qa })),
      tarEntry('evidence/release-candidate.json', JSON.stringify({ ...baseRelease, ...release })),
      tarEntry('evidence/publishing-receipt.json', JSON.stringify({ ...basePublishing, ...publishing }))
    );
  }
  return tar(entries);
}

test('reads only reviewed planning intent from a bounded starter tar', () => {
  const archive = tar([
    tarEntry('OPEN_PROJECT.html', '<!doctype html>'),
    tarEntry('starter/project.manifest.json', manifestText),
    tarEntry('starter/dist/index.html', '<!doctype html><title>playable</title>')
  ]);
  const text = portableStarterManifestTextFromTarBytes(archive);
  assert.equal(text, manifestText);
  assert.deepEqual(parsePortableStarterBriefText(text), {
    name: 'Pipeline Sample Game',
    objective: 'Prove a dependency-free build, QA, release-candidate, and publishing dry run.',
    targetPlatform: 'web',
    mechanic: 'collect'
  });
});

test('requires the exact canonical manifest path and ignores nested lookalikes', () => {
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('untrusted/starter/project.manifest.json', manifestText)
  ])), /starter\/project\.manifest\.json/i);

  const canonicalWithLookalike = tar([
    tarEntry('starter/project.manifest.json', manifestText),
    tarEntry('untrusted/starter/project.manifest.json', '{"not":"authority"}')
  ]);
  assert.equal(portableStarterManifestTextFromTarBytes(canonicalWithLookalike), manifestText);
});

test('rejects duplicate, missing, unsafe and non-regular canonical manifest entries', () => {
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([tarEntry('OPEN_PROJECT.html', 'x')])), /starter\/project\.manifest\.json/i);
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('starter/project.manifest.json', manifestText),
    tarEntry('starter/project.manifest.json', manifestText)
  ])), /duplicate archive path/i);
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('../starter/project.manifest.json', manifestText)
  ])), /unsafe archive path/i);
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('starter/project.manifest.json', '', '2')
  ])), /unsupported archive entry type/i);
});

test('requires complete padded records and a strict two-block tar terminator', () => {
  const entry = tarEntry('starter/project.manifest.json', manifestText);
  const missingTerminators = tar([entry]).subarray(0, entry.byteLength);
  assert.throws(() => portableStarterManifestTextFromTarBytes(missingTerminators), /two-block tar terminator/i);

  const complete = tar([entry]);
  const singleTerminator = complete.subarray(0, complete.byteLength - 512);
  assert.throws(() => portableStarterManifestTextFromTarBytes(singleTerminator), /two-block tar terminator/i);

  const shortEntry = tarEntry('starter/project.manifest.json', '{}');
  const truncatedPadding = shortEntry.subarray(0, 513);
  assert.throws(() => portableStarterManifestTextFromTarBytes(truncatedPadding), /truncated/i);

  const trailingGarbage = concat(complete, new Uint8Array([1]));
  assert.throws(() => portableStarterManifestTextFromTarBytes(trailingGarbage), /invalid trailing data/i);

  const malformedSecondTerminator = complete.slice();
  malformedSecondTerminator[malformedSecondTerminator.byteLength - 512] = 1;
  assert.throws(() => portableStarterManifestTextFromTarBytes(malformedSecondTerminator), /malformed tar terminator/i);
});

test('rejects corrupt checksums, truncated archives and unsafe size/count bounds', () => {
  const corrupt = tar([tarEntry('starter/project.manifest.json', manifestText)]);
  corrupt[10] ^= 1;
  assert.throws(() => portableStarterManifestTextFromTarBytes(corrupt), /checksum/i);

  const truncated = tar([tarEntry('starter/project.manifest.json', manifestText)]).subarray(0, 700);
  assert.throws(() => portableStarterManifestTextFromTarBytes(truncated), /truncated/i);

  const tooMany = tar(Array.from({ length: portableStarterBundleLimits.entries + 1 }, (_, index) => tarEntry(`file-${index}.txt`, 'x')));
  assert.throws(() => portableStarterManifestTextFromTarBytes(tooMany), /no more than 256 entries/i);

  const oversizedManifest = new Uint8Array(portableStarterBundleLimits.manifestBytes + 1).fill(65);
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('starter/project.manifest.json', oversizedManifest)
  ])), /between 1 byte/i);
});

test('returns a bounded truthful verification preflight for a valid local bundle', async () => {
  const imported = await verifiedPortableStarterImportFromTarBytes(verifiedArchive());
  assert.equal(imported.manifestText, manifestText);
  assert.deepEqual(imported.verification, {
    artifactPath: 'dist',
    artifactSha256: artifactSha256('<!doctype html><title>playable</title>'),
    destination: 'local://planned/sample-game',
    buildStatus: 'executed-pass',
    qaStatus: 'executed-pass',
    releaseCandidateStatus: 'dry-run-only',
    publicationStatus: 'not-executed',
    secretsStatus: 'not-used'
  });
});

test('accepts a verified local bundle only when build, QA, release and packaged artifact bytes agree', async () => {
  const text = await verifiedPortableStarterManifestTextFromTarBytes(verifiedArchive());
  assert.equal(text, manifestText);
  assert.deepEqual(parsePortableStarterBriefText(text), {
    name: 'Pipeline Sample Game',
    objective: 'Prove a dependency-free build, QA, release-candidate, and publishing dry run.',
    targetPlatform: 'web',
    mechanic: 'collect'
  });
});

test('rejects manifest-shaped archives that are not verified local starter bundles', async () => {
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(verifiedArchive({ includeEvidence: false })), /evidence\/build-result\.json/i);
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(verifiedArchive({ build: { executed: false } })), /verified local dry-run contract/i);
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(verifiedArchive({ qa: { status: 'fail' } })), /verified local dry-run contract/i);
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(verifiedArchive({ release: { dryRunOnly: false } })), /verified local dry-run contract/i);
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(verifiedArchive({ publishing: { executed: true } })), /verified local dry-run contract/i);
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(verifiedArchive({ publishing: { secretsUsed: true } })), /verified local dry-run contract/i);
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(verifiedArchive({ publishing: { destination: { kind: 'remote', target: 'https://example.com' } } })), /verified local dry-run contract/i);
});

test('rejects a bundle whose packaged playable bytes no longer match the retained evidence', async () => {
  const originalBody = '<!doctype html><title>playable</title>';
  const tamperedBody = '<!doctype html><title>tampered playable</title>';
  const digest = artifactSha256(originalBody);
  const archive = verifiedArchive({
    indexBody: tamperedBody,
    build: { artifactSha256: digest },
    qa: { artifactSha256: digest },
    release: { build: { artifactPath: 'dist', outputSha256: digest } }
  });
  await assert.rejects(() => verifiedPortableStarterImportFromTarBytes(archive), /artifact bytes do not match/i);
});

test('does not upgrade historical execution or publication authority', async () => {
  const imported = await verifiedPortableStarterImportFromTarBytes(verifiedArchive());
  const brief = parsePortableStarterBriefText(imported.manifestText);
  assert.deepEqual(Object.keys(brief).sort(), ['mechanic', 'name', 'objective', 'targetPlatform']);
  assert.equal('build' in brief, false);
  assert.equal('qa' in brief, false);
  assert.equal('releaseCandidate' in brief, false);
  assert.equal('publish' in brief, false);
  assert.equal('secrets' in brief, false);
  assert.equal('executed' in imported.verification, false);
  assert.equal('authority' in imported.verification, false);
});
