import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const candidateRoot = process.cwd();
const distRoot = path.join(candidateRoot, 'dist');
const artifactRoot = path.join(candidateRoot, 'artifacts', 'bundle-attribution');
const testedRevision = process.env.CANDIDATE_HEAD_SHA ?? '';

fs.mkdirSync(artifactRoot, { recursive: true });

function walk(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function normalizeSource(source) {
  return source.replaceAll('\\', '/').replace(/^webpack:\/\//, '');
}

function packageNameFromSource(source) {
  const normalized = normalizeSource(source);
  const marker = '/node_modules/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) return null;
  const tail = normalized.slice(markerIndex + marker.length);
  const parts = tail.split('/');
  if (parts[0]?.startsWith('@')) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  return parts[0] ?? null;
}

function categoryForSource(source) {
  const normalized = normalizeSource(source);
  const pkg = packageNameFromSource(normalized);
  if (pkg === 'three') return 'three';
  if (pkg === 'jolt-physics') return 'jolt-physics';
  if (pkg) return 'other-node-modules';
  if (normalized.includes('/src/') || normalized.startsWith('../src/') || normalized.startsWith('../../src/') || normalized.startsWith('src/')) {
    return 'candidate';
  }
  return 'other-source';
}

function percent(part, whole) {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(3));
}

const failures = [];
if (!/^[0-9a-f]{40}$/i.test(testedRevision)) failures.push('CANDIDATE_HEAD_SHA is missing or malformed');
if (!fs.existsSync(distRoot)) failures.push('dist/ does not exist; production build with source maps must run first');

const jsFiles = fs.existsSync(distRoot)
  ? walk(distRoot).filter((file) => file.endsWith('.js') && !file.endsWith('.js.map')).sort()
  : [];

if (jsFiles.length === 0) failures.push('no production JavaScript chunks found');

const chunks = [];
const sourceRecords = new Map();
let mapCount = 0;
let mapsWithSourcesContent = 0;

for (const jsFile of jsFiles) {
  const relative = path.relative(candidateRoot, jsFile).replaceAll('\\', '/');
  const bytes = fs.readFileSync(jsFile);
  const mapFile = `${jsFile}.map`;
  const chunk = {
    file: relative,
    raw_bytes: bytes.byteLength,
    gzip_bytes: zlib.gzipSync(bytes, { level: 9 }).byteLength,
    sourcemap: fs.existsSync(mapFile) ? path.relative(candidateRoot, mapFile).replaceAll('\\', '/') : null,
  };
  chunks.push(chunk);

  if (!fs.existsSync(mapFile)) continue;
  mapCount += 1;
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  if (!Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)) continue;
  if (map.sourcesContent.some((content) => typeof content === 'string')) mapsWithSourcesContent += 1;

  for (let index = 0; index < map.sources.length; index += 1) {
    const source = map.sources[index];
    const content = map.sourcesContent[index];
    if (typeof source !== 'string' || typeof content !== 'string') continue;
    const normalized = normalizeSource(source);
    const key = `${normalized}\u0000${content.length}`;
    if (sourceRecords.has(key)) continue;
    sourceRecords.set(key, {
      source: normalized,
      category: categoryForSource(normalized),
      package: packageNameFromSource(normalized),
      source_bytes: Buffer.byteLength(content),
    });
  }
}

const sources = [...sourceRecords.values()].sort((a, b) => b.source_bytes - a.source_bytes || a.source.localeCompare(b.source));
const totalSourceBytes = sources.reduce((sum, item) => sum + item.source_bytes, 0);
const categories = new Map();
for (const item of sources) {
  const current = categories.get(item.category) ?? { source_bytes: 0, source_count: 0 };
  current.source_bytes += item.source_bytes;
  current.source_count += 1;
  categories.set(item.category, current);
}

const categorySummary = Object.fromEntries(
  [...categories.entries()]
    .sort(([, a], [, b]) => b.source_bytes - a.source_bytes)
    .map(([name, stats]) => [name, {
      ...stats,
      represented_source_percent: percent(stats.source_bytes, totalSourceBytes),
    }]),
);

const runtimePackages = ['three', 'jolt-physics'];
for (const required of runtimePackages) {
  if ((categorySummary[required]?.source_bytes ?? 0) <= 0) failures.push(`source-map attribution did not represent ${required}`);
}
if ((categorySummary.candidate?.source_bytes ?? 0) <= 0) failures.push('source-map attribution did not represent candidate src/ code');
if (mapCount === 0) failures.push('no JavaScript source maps were emitted');
if (mapsWithSourcesContent === 0) failures.push('source maps contain no sourcesContent for attribution');
if (totalSourceBytes === 0) failures.push('represented source bytes are zero');

const totalRawBytes = chunks.reduce((sum, chunk) => sum + chunk.raw_bytes, 0);
const totalGzipBytes = chunks.reduce((sum, chunk) => sum + chunk.gzip_bytes, 0);
const largestCategory = Object.entries(categorySummary)[0] ?? null;

const result = {
  schema_version: 1,
  tested_revision: testedRevision,
  measurement_kind: 'production-bundle-source-map-attribution',
  passed: failures.length === 0,
  failures,
  emitted_javascript: {
    chunk_count: chunks.length,
    total_raw_bytes: totalRawBytes,
    total_gzip_bytes: totalGzipBytes,
    chunks,
  },
  source_map_attribution: {
    map_count: mapCount,
    maps_with_sources_content: mapsWithSourcesContent,
    unique_source_count: sources.length,
    represented_source_bytes: totalSourceBytes,
    categories: categorySummary,
    largest_category: largestCategory ? {
      name: largestCategory[0],
      source_bytes: largestCategory[1].source_bytes,
      represented_source_percent: largestCategory[1].represented_source_percent,
    } : null,
    top_sources: sources.slice(0, 25),
  },
  interpretation_limits: {
    represented_source_bytes_are_not_minified_bytes: true,
    represented_source_bytes_are_not_runtime_cpu_cost: true,
    target_device_performance_claimed: false,
    optimization_success_claimed: false,
    human_playability_claimed: false,
    release_readiness_claimed: false,
  },
};

const resultPath = path.join(artifactRoot, 'bundle-attribution-result.json');
fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);

const markdown = [
  '# Three.js production bundle attribution',
  '',
  `- Exact revision: \`${testedRevision}\``,
  `- Production JS: ${(totalRawBytes / 1024 / 1024).toFixed(2)} MiB raw / ${(totalGzipBytes / 1024 / 1024).toFixed(2)} MiB gzip across ${chunks.length} chunk(s)`,
  `- Represented original source: ${(totalSourceBytes / 1024 / 1024).toFixed(2)} MiB across ${sources.length} unique source entries`,
  `- Source maps with sourcesContent: ${mapsWithSourcesContent}/${mapCount}`,
  '',
  '## Represented original-source composition',
  '',
  ...Object.entries(categorySummary).map(([name, stats]) => `- ${name}: ${(stats.source_bytes / 1024 / 1024).toFixed(2)} MiB (${stats.represented_source_percent}%), ${stats.source_count} source(s)`),
  '',
  '## Largest represented sources',
  '',
  ...sources.slice(0, 15).map((item) => `- ${(item.source_bytes / 1024).toFixed(1)} KiB — ${item.category} — \`${item.source}\``),
  '',
  '## Evidence boundary',
  '',
  'Source-map `sourcesContent` bytes describe represented original source, not minified byte ownership, CPU/GPU cost, target-device performance, or an optimization result. This gate changes no gameplay or bundling strategy.',
  '',
  `Result: **${result.passed ? 'PASS' : 'FAIL'}**`,
  ...(failures.length ? ['', ...failures.map((failure) => `- ${failure}`)] : []),
  '',
].join('\n');
fs.writeFileSync(path.join(artifactRoot, 'bundle-attribution-summary.md'), markdown);

console.log(markdown);
if (!result.passed) process.exitCode = 1;
