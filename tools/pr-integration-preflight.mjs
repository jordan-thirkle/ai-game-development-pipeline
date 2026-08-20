#!/usr/bin/env node

const API_VERSION = '2022-11-28';

export function analyzeIntegrationRisk({ currentPr, compare, peerFiles }) {
  const currentNumber = currentPr.number;
  const currentFiles = new Set(currentPr.files ?? []);
  const overlaps = [];
  const incompleteFileInventories = [];

  if (currentPr.files_complete !== true) {
    incompleteFileInventories.push({
      number: currentNumber,
      expected: Number.isInteger(currentPr.changed_files) ? currentPr.changed_files : null,
      retrieved: currentFiles.size
    });
  }

  for (const peer of peerFiles ?? []) {
    if (peer.number === currentNumber) continue;
    const peerFileSet = new Set(peer.files ?? []);
    if (peer.files_complete !== true) {
      incompleteFileInventories.push({
        number: peer.number,
        expected: Number.isInteger(peer.changed_files) ? peer.changed_files : null,
        retrieved: peerFileSet.size
      });
    }
    const shared = [...peerFileSet].filter((path) => currentFiles.has(path)).sort();
    if (shared.length > 0) {
      overlaps.push({ number: peer.number, title: peer.title ?? '', files: shared });
    }
  }

  overlaps.sort((a, b) => a.number - b.number);
  incompleteFileInventories.sort((a, b) => a.number - b.number);
  const behindBy = Number.isInteger(compare?.behind_by) ? compare.behind_by : null;
  const aheadBy = Number.isInteger(compare?.ahead_by) ? compare.ahead_by : null;
  const staleBase = behindBy !== null && behindBy > 0;
  const knownMergeConflict = currentPr.mergeable === false;
  const mergeabilityUnknown = currentPr.mergeable !== true && currentPr.mergeable !== false;

  const blockers = [];
  if (knownMergeConflict) blockers.push('github-reports-merge-conflict');
  if (mergeabilityUnknown) blockers.push('github-mergeability-unknown');
  if (incompleteFileInventories.length > 0) blockers.push('incomplete-pr-file-inventory');
  if (overlaps.length > 0) blockers.push('open-pr-file-overlap');

  return {
    pr: currentNumber,
    base: currentPr.base,
    head: currentPr.head,
    behind_by: behindBy,
    ahead_by: aheadBy,
    stale_base: staleBase,
    mergeable: currentPr.mergeable ?? null,
    incomplete_file_inventories: incompleteFileInventories,
    overlaps,
    blockers,
    safe_to_continue: blockers.length === 0,
    evidence_boundary:
      'This preflight detects GitHub-visible base drift, known merge conflicts, and exact changed-file overlap only when GitHub mergeability is resolved and every inspected PR file inventory is complete. Unknown mergeability or incomplete API inventories fail closed. It does not prove semantic independence, runtime correctness, or merge readiness.'
  };
}

function parseLinkHeader(value) {
  if (!value) return {};
  const links = {};
  for (const part of value.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

async function requestJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'byjtt-pr-integration-preflight'
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}`);
  }
  return { data: await response.json(), links: parseLinkHeader(response.headers.get('link')) };
}

async function requestAll(url, token) {
  const all = [];
  let next = url;
  while (next) {
    const { data, links } = await requestJson(next, token);
    if (!Array.isArray(data)) throw new Error(`Expected array from ${next}`);
    all.push(...data);
    next = links.next ?? null;
  }
  return all;
}

function summarizeFileInventory(pr, files) {
  const changedFiles = Number.isInteger(pr.changed_files) ? pr.changed_files : null;
  return {
    changed_files: changedFiles,
    files_complete: changedFiles !== null && files.length === changedFiles
  };
}

export async function loadLiveState({ repository, prNumber, token, apiBase = 'https://api.github.com' }) {
  const repoUrl = `${apiBase}/repos/${repository}`;
  const { data: pr } = await requestJson(`${repoUrl}/pulls/${prNumber}`, token);
  const [files, peers, compareResponse] = await Promise.all([
    requestAll(`${repoUrl}/pulls/${prNumber}/files?per_page=100`, token),
    requestAll(`${repoUrl}/pulls?state=open&per_page=100`, token),
    requestJson(`${repoUrl}/compare/${encodeURIComponent(pr.base.ref)}...${encodeURIComponent(pr.head.sha)}`, token)
  ]);

  const peerFiles = await Promise.all(
    peers
      .filter((peer) => peer.number !== prNumber)
      .map(async (peer) => {
        const changed = await requestAll(`${repoUrl}/pulls/${peer.number}/files?per_page=100`, token);
        return {
          number: peer.number,
          title: peer.title,
          files: changed.map((file) => file.filename),
          ...summarizeFileInventory(peer, changed)
        };
      })
  );

  return {
    currentPr: {
      number: pr.number,
      base: pr.base.ref,
      head: pr.head.sha,
      mergeable: pr.mergeable,
      files: files.map((file) => file.filename),
      ...summarizeFileInventory(pr, files)
    },
    compare: compareResponse.data,
    peerFiles
  };
}

function renderSummary(result) {
  const lines = [
    `PR #${result.pr} integration preflight`,
    `base=${result.base} head=${result.head}`,
    `behind_by=${result.behind_by ?? 'unknown'} ahead_by=${result.ahead_by ?? 'unknown'} mergeable=${String(result.mergeable)}`,
    `stale_base=${result.stale_base} blockers=${result.blockers.length}`
  ];
  for (const inventory of result.incomplete_file_inventories) {
    lines.push(
      `incomplete file inventory PR #${inventory.number}: retrieved=${inventory.retrieved} expected=${inventory.expected ?? 'unknown'}`
    );
  }
  if (result.overlaps.length > 0) {
    for (const overlap of result.overlaps) {
      lines.push(`overlap PR #${overlap.number}: ${overlap.files.join(', ')}`);
    }
  }
  lines.push(result.evidence_boundary);
  return lines.join('\n');
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const prNumber = Number.parseInt(process.env.PR_NUMBER ?? '', 10);
  if (!token || !repository || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, and positive integer PR_NUMBER are required');
  }

  const state = await loadLiveState({ repository, prNumber, token });
  const result = analyzeIntegrationRisk(state);
  console.log(JSON.stringify(result, null, 2));
  console.error(renderSummary(result));
  if (!result.safe_to_continue) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
