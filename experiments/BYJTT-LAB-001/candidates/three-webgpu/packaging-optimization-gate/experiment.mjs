import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const candidate = resolve(process.env.CANDIDATE || '.');
const artifactDir = resolve(candidate, 'artifacts/packaging-optimization');
const sourcePath = resolve(candidate, 'src/main.js');
const backupPath = resolve(artifactDir, 'main.baseline.js');
const mode = process.argv[2];
const label = process.argv[3];

await mkdir(artifactDir, { recursive: true });

const originalImports = "import * as THREE from 'three';\nimport { WebGPURenderer } from 'three/webgpu';\nimport initJolt from 'jolt-physics';";
const optimizedImports = "import * as THREE from 'three/webgpu';\nimport initJolt from 'jolt-physics/wasm';\nimport joltWasmUrl from 'jolt-physics/jolt-physics.wasm.wasm?url';";

async function filesUnder(root) {
  const out = [];
  for (const entry of await readdir(root)) {
    const path = resolve(root, entry);
    const info = await stat(path);
    if (info.isDirectory()) out.push(...await filesUnder(path));
    else out.push(path);
  }
  return out;
}

async function measure(name) {
  const dist = resolve(candidate, 'dist');
  const files = await filesUnder(dist);
  const assets = [];
  let jsRaw = 0;
  let jsGzip = 0;
  let wasmRaw = 0;
  let wasmGzip = 0;
  for (const file of files) {
    const bytes = await readFile(file);
    const raw = bytes.length;
    const gzip = gzipSync(bytes, { level: 9 }).length;
    const extension = extname(file).toLowerCase();
    if (extension === '.js') { jsRaw += raw; jsGzip += gzip; }
    if (extension === '.wasm') { wasmRaw += raw; wasmGzip += gzip; }
    assets.push({ path: relative(dist, file), extension, raw_bytes: raw, gzip_bytes: gzip });
  }
  const result = {
    label: name,
    js_raw_bytes: jsRaw,
    js_gzip_bytes: jsGzip,
    wasm_raw_bytes: wasmRaw,
    wasm_gzip_bytes: wasmGzip,
    js_wasm_raw_bytes: jsRaw + wasmRaw,
    js_wasm_gzip_bytes: jsGzip + wasmGzip,
    assets
  };
  await writeFile(resolve(artifactDir, `${name}-bundle.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

async function apply() {
  const source = await readFile(sourcePath, 'utf8');
  if (!source.includes(originalImports)) throw new Error('Integrated import precondition changed; refusing broad transform.');
  if (!source.includes('const renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });')) throw new Error('WebGPURenderer construction precondition changed.');
  if (!source.includes('const Jolt = await initJolt();')) throw new Error('Jolt initialization precondition changed.');
  await writeFile(backupPath, source);
  let optimized = source.replace(originalImports, optimizedImports);
  optimized = optimized.replace(
    'const renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });',
    'const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: false });'
  );
  optimized = optimized.replace(
    'const Jolt = await initJolt();',
    'const Jolt = await initJolt({ locateFile: () => joltWasmUrl });'
  );
  if (optimized === source) throw new Error('Packaging transform made no change.');
  await writeFile(sourcePath, optimized);
  const summary = {
    source: 'src/main.js',
    changes: [
      "THREE namespace: 'three' + named WebGPURenderer import -> unified 'three/webgpu' namespace",
      "Jolt entry: default wasm-compat -> 'jolt-physics/wasm' with emitted wasm URL via Vite"
    ],
    gameplay_constants_changed: false,
    gameplay_logic_changed: false,
    dependency_versions_changed: false
  };
  await writeFile(resolve(artifactDir, 'transform.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

async function restore() {
  const original = await readFile(backupPath, 'utf8');
  await writeFile(sourcePath, original);
}

async function compare() {
  const baseline = JSON.parse(await readFile(resolve(artifactDir, 'baseline-bundle.json'), 'utf8'));
  const optimized = JSON.parse(await readFile(resolve(artifactDir, 'optimized-bundle.json'), 'utf8'));
  const jsGzipReduction = baseline.js_gzip_bytes > 0
    ? (baseline.js_gzip_bytes - optimized.js_gzip_bytes) / baseline.js_gzip_bytes
    : 0;
  const combinedGzipReduction = baseline.js_wasm_gzip_bytes > 0
    ? (baseline.js_wasm_gzip_bytes - optimized.js_wasm_gzip_bytes) / baseline.js_wasm_gzip_bytes
    : 0;
  const failures = [];
  if (baseline.js_gzip_bytes <= 0) failures.push('baseline JavaScript gzip bytes missing');
  if (baseline.wasm_raw_bytes !== 0) failures.push('baseline unexpectedly emitted standalone WASM');
  if (optimized.wasm_raw_bytes <= 0) failures.push('optimized build did not emit standalone WASM');
  if (jsGzipReduction < 0.20) failures.push(`JavaScript gzip reduction ${(jsGzipReduction * 100).toFixed(2)}% < 20%`);
  if (optimized.js_wasm_gzip_bytes > baseline.js_wasm_gzip_bytes) failures.push('combined JS+WASM gzip bytes increased');
  const result = {
    tested_revision: process.env.CANDIDATE_HEAD_SHA || null,
    baseline,
    optimized,
    js_gzip_reduction_ratio: jsGzipReduction,
    combined_js_wasm_gzip_reduction_ratio: combinedGzipReduction,
    standalone_wasm_emitted: optimized.wasm_raw_bytes > 0,
    phase_a_contract_changed: false,
    dependency_versions_changed: false,
    target_device_performance_claimed: false,
    runtime_speedup_claimed: false,
    human_tested: false,
    passed: failures.length === 0,
    failures
  };
  await writeFile(resolve(artifactDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
}

if (mode === 'measure') {
  if (!label) throw new Error('measure requires a label');
  await measure(label);
} else if (mode === 'apply') {
  await apply();
} else if (mode === 'restore') {
  await restore();
} else if (mode === 'compare') {
  await compare();
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
