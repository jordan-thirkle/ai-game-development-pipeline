import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outputDir = resolve(root, 'public', 'ammo');

const upstream = {
  repository: 'playcanvas/engine',
  ref: 'v2.21.3',
  path: 'examples/assets/wasm/ammo',
  files: [
    { name: 'ammo.js', blobSha: '0ab481f240a91a7471dd500d1a780078846f7fb0', size: 2002476, sha256: 'ef166d1315bc4a6441a8de341ecdf6ac4e7d69055caec65c523ed1a4e8e19b15' },
    { name: 'ammo.wasm.js', blobSha: 'c11e0aa6a9a189627309234911a03be7a263cf93', size: 451161, sha256: '5645b5a0c4f03be9d9d1ae604ffacd5e5e525310cfd1d0ed27474cdd1f34aab0' },
    { name: 'ammo.wasm.wasm', blobSha: '6087335f44123638d8d958c509826e92b57c25e6', size: 748374, sha256: 'a61b504d4a6ce6bb93bd843e0f61edb8115e7317f1b3462247031a83ddb25d09' }
  ]
};

function gitBlobSha(buffer) {
  const prefix = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return createHash('sha1').update(prefix).update(buffer).digest('hex');
}

await mkdir(outputDir, { recursive: true });
const evidence = [];

for (const file of upstream.files) {
  const url = `https://raw.githubusercontent.com/${upstream.repository}/${upstream.ref}/${upstream.path}/${file.name}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Ammo acquisition failed for ${file.name}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== file.size) {
    throw new Error(`${file.name} size mismatch: expected ${file.size}, got ${buffer.length}`);
  }
  const blobSha = gitBlobSha(buffer);
  if (blobSha !== file.blobSha) {
    throw new Error(`${file.name} Git blob mismatch: expected ${file.blobSha}, got ${blobSha}`);
  }
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (sha256 !== file.sha256) {
    throw new Error(`${file.name} SHA-256 mismatch: expected ${file.sha256}, got ${sha256}`);
  }
  await writeFile(resolve(outputDir, file.name), buffer);
  evidence.push({
    name: file.name,
    bytes: buffer.length,
    git_blob_sha1: blobSha,
    sha256,
    source_url: url
  });
}

const manifest = {
  schema_version: 1,
  candidate_id: 'playcanvas',
  purpose: 'PlayCanvas integrated tracer native Ammo boundary',
  upstream: {
    repository: upstream.repository,
    ref: upstream.ref,
    path: upstream.path
  },
  files: evidence
};

await writeFile(resolve(outputDir, 'provenance.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));
