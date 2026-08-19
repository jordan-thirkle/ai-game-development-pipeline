import fs from 'node:fs/promises';
import process from 'node:process';
import { auditOwnershipProjection, projectOwnership } from './control-plane-ownership.mjs';

const statePath = process.env.CONTROL_PLANE_STATE ?? 'fixtures/control-plane/BYJTT-LAB-001.json';
const write = process.argv.includes('--write');
const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('GITHUB_TOKEN is required to read live ownership from a private repository.');
  process.exit(2);
}

const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
const repository = state.project?.repository;
if (!repository || !repository.includes('/')) {
  console.error(`Control-plane state ${statePath} does not declare project.repository.`);
  process.exit(2);
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
};

const getJson = async (path) => {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status} for ${path}: ${await response.text()}`);
  }
  return response.json();
};

const pulls = await getJson('/pulls?state=open&per_page=100');
const pullsWithFiles = [];
for (const pull of pulls) {
  const files = await getJson(`/pulls/${pull.number}/files?per_page=100`);
  pullsWithFiles.push({
    number: pull.number,
    title: pull.title,
    draft: pull.draft,
    head: { ref: pull.head.ref, sha: pull.head.sha },
    base: { ref: pull.base.ref, sha: pull.base.sha },
    files: files.map(({ filename }) => ({ filename })),
  });
}

const { claims, drift } = auditOwnershipProjection(state, pullsWithFiles);
const summary = [...claims.entries()].map(([workstreamId, pull]) => ({
  workstreamId,
  pullNumber: pull.number,
  branch: pull.head.ref,
}));

if (!write) {
  console.log(JSON.stringify({ statePath, claims: summary, drift }, null, 2));
  process.exitCode = drift.length === 0 ? 0 : 1;
} else {
  const projectedAt = new Date().toISOString();
  const projected = projectOwnership(state, pullsWithFiles, projectedAt);
  await fs.writeFile(statePath, `${JSON.stringify(projected, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        statePath,
        ownershipProjectedAt: projectedAt,
        claims: summary,
        correctedFields: drift.length,
        generatedAtPreserved: projected.generatedAt === state.generatedAt,
      },
      null,
      2,
    ),
  );
}
