import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  portableStarterBundleLimits,
  portableStarterManifestTextFromTarBytes
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

function tar(entries) {
  const length = entries.reduce((sum, entry) => sum + entry.byteLength, 0) + 1024;
  const result = new Uint8Array(length);
  let offset = 0;
  for (const entry of entries) {
    result.set(entry, offset);
    offset += entry.byteLength;
  }
  return result;
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

test('rejects duplicate, missing, unsafe and non-regular manifest entries', () => {
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([tarEntry('OPEN_PROJECT.html', 'x')])), /exactly one starter\/project\.manifest\.json/i);
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('starter/project.manifest.json', manifestText),
    tarEntry('copy/starter/project.manifest.json', manifestText)
  ])), /more than one/i);
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('../starter/project.manifest.json', manifestText)
  ])), /unsafe archive path/i);
  assert.throws(() => portableStarterManifestTextFromTarBytes(tar([
    tarEntry('starter/project.manifest.json', '', '2')
  ])), /unsupported archive entry type/i);
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

test('does not upgrade historical execution or publication authority', () => {
  const archive = tar([tarEntry('starter/project.manifest.json', manifestText)]);
  const brief = parsePortableStarterBriefText(portableStarterManifestTextFromTarBytes(archive));
  assert.deepEqual(Object.keys(brief).sort(), ['mechanic', 'name', 'objective', 'targetPlatform']);
  assert.equal('build' in brief, false);
  assert.equal('qa' in brief, false);
  assert.equal('releaseCandidate' in brief, false);
  assert.equal('publish' in brief, false);
  assert.equal('secrets' in brief, false);
});
