#!/usr/bin/env node

const API_VERSION = '2022-11-28';
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 250;

export function analyzeIntegrationRisk({ currentPr, compare, peerFiles }) {
  const currentNumber = currentPr.number;
  const currentFiles = new Set(currentPr.files ?? []);
  const overlaps = [];
  const incompleteFileInventories = [];
  const inconsistentSnapshots = [];

  if (currentPr.revision_consistent !== true) {
    inconsistentSnapshots.push({ number: currentNumber, kind: 'current-pr' });
  }

  if (currentPr.files_complete !== true) {
    incompleteFileInventories.push({
      number: currentNumber,
      expected: Number.isInteger(currentPr.changed_files) ? currentPr.changed_files : null,
      retrieved: currentFiles.size
    });
  }

  for (const peer of peerFiles ?? []) {
    if (peer.number === currentNumber) continue;
    if (peer.revision_consistent !== true) {
      inconsistentSnapshots.push({ number: peer.number, kind: 'peer-pr' });
    }
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
  inconsistentSnapshots.sort((a, b) => a.number - b.number || a.kind.localeCompare(b.kind));
  const behindBy = Number.isInteger(compare?.behind_by) ? compare.behind_by : null;
  const aheadBy = Number.isInteger(compare?.ahead_by) ? compare.ahead_by : null;
  const staleBase = behindBy !== null && behindBy > 0;
  const knownMergeConflict = currentPr.mergeable === false;
  const mergeabilityUnknown = currentPr.mergeable !== true && currentPr.mergeable !== false;

  const blockers = [];
  if (knownMergeConflict) blockers.push('github-reports-merge-conflict');
  if (mergeabilityUnknown) blockers.push('github-mergeability-unknown');
  if (inconsistentSnapshots.some((snapshot) => snapshot.kind === 'current-pr')) {
    blockers.push('current-pr-state-changed-during-scan');
  }
  if (inconsistentSnapshots.some((snapshot) => snapshot.kind === 'peer-pr')) {
    blockers.push('peer-pr-state-changed-during-scan');
  }
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
    inconsistent_snapshots: inconsistentSnapshots,
    incomplete_file_inventories: incompleteFileInventories,
    overlaps,
    blockers,
    safe_to_continue: blockers.length === 0,
    evidence_boundary:
      'This preflight detects GitHub-visible base drift, known merge conflicts, and exact changed-file overlap only when GitHub mergeability is resolved, inspected PR revisions remain stable for the scan, and every inspected PR file inventory is complete. Unknown mergeability, revision drift, or incomplete API inventories fail closed. It does not prove semantic independence, runtime correctness, or merge readiness.'
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

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response, attempt, nowMs, fallbackMs) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter !== null) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }

  const reset = response.headers.get('x-ratelimit-reset');
  if (reset !== null) {
    const resetSeconds = Number.parseInt(reset, 10);
    if (Number.isInteger(resetSeconds)) return Math.max(0, resetSeconds * 1000 - nowMs);
  }

  return fallbackMs * 2 ** (attempt - 1);
}

async function requestJson(
  url,
  token,
  {
    fetchFn = fetch,
    sleepFn = defaultSleep,
    nowFn = Date.now,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    retryDelay = DEFAULT_RETRY_DELAY_MS
  } = {}
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchFn(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': 'byjtt-pr-integration-preflight'
      }
    });

    if (response.ok) {
      return { data: await response.json(), links: parseLinkHeader(response.headers.get('link')) };
    }

    const retryable = response.status === 403 || response.status === 429;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`GitHub API ${response.status} for ${url}`);
    }

    await sleepFn(retryDelayMs(response, attempt, nowFn(), retryDelay));
  }

  throw new Error(`GitHub API retry budget exhausted for ${url}`);
}

async function requestAll(url, token, options) {
  const all = [];
  let next = url;
  while (next) {
    const { data, links } = await requestJson(next, token, options);
    if (!Array.isArray(data)) throw new Error(`Expected array from ${next}`);
    all.push(...data);
    next = links.next ?? null;
  }
  return all;
}

export async function mapWithConcurrency(items, limit, mapper) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('concurrency limit must be a positive integer');
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function summarizeFileInventory(pr, files) {
  const changedFiles = Number.isInteger(pr.changed_files) ? pr.changed_files : null;
  return {
    changed_files: changedFiles,
    files_complete: changedFiles !== null && files.length === changedFiles
  };
}

function snapshotIdentity(pr) {
  return {
    base_ref: pr?.base?.ref ?? null,
    base_sha: pr?.base?.sha ?? null,
    head_sha: pr?.head?.sha ?? null,
    changed_files: Number.isInteger(pr?.changed_files) ? pr.changed_files : null,
    state: pr?.state ?? null
  };
}

function sameRevision(left, right) {
  return (
    left.base_ref === right.base_ref &&
    left.base_sha === right.base_sha &&
    left.head_sha === right.head_sha &&
    left.state === right.state
  );
}

function sameSnapshot(left, right) {
  return sameRevision(left, right) && left.changed_files === right.changed_files;
}

async function resolveMergeability(pr, prUrl, token, requestOptions, { maxPolls, pollDelayMs }) {
  let current = pr;
  for (let poll = 0; current.mergeable === null && poll < maxPolls; poll += 1) {
    await requestOptions.sleepFn(pollDelayMs);
    current = (await requestJson(prUrl, token, requestOptions)).data;
  }
  return current;
}

export async function loadLiveState({
  repository,
  prNumber,
  token,
  apiBase = 'https://api.github.com',
  fetchFn = fetch,
  sleepFn = defaultSleep,
  nowFn = Date.now,
  concurrency = DEFAULT_CONCURRENCY,
  maxRequestAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelay = DEFAULT_RETRY_DELAY_MS,
  mergeabilityPolls = 3,
  mergeabilityPollDelayMs = 250
}) {
  const repoUrl = `${apiBase}/repos/${repository}`;
  const prUrl = `${repoUrl}/pulls/${prNumber}`;
  const requestOptions = {
    fetchFn,
    sleepFn,
    nowFn,
    maxAttempts: maxRequestAttempts,
    retryDelay
  };

  const initialPr = (await requestJson(prUrl, token, requestOptions)).data;
  const initialIdentity = snapshotIdentity(initialPr);
  const resolvedPr = await resolveMergeability(initialPr, prUrl, token, requestOptions, {
    maxPolls: mergeabilityPolls,
    pollDelayMs: mergeabilityPollDelayMs
  });
  const mergeabilityIdentityConsistent = sameSnapshot(initialIdentity, snapshotIdentity(resolvedPr));

  const [files, peers, compareResponse] = await Promise.all([
    requestAll(`${repoUrl}/pulls/${prNumber}/files?per_page=100`, token, requestOptions),
    requestAll(`${repoUrl}/pulls?state=open&per_page=100`, token, requestOptions),
    requestJson(
      `${repoUrl}/compare/${encodeURIComponent(resolvedPr.base.ref)}...${encodeURIComponent(resolvedPr.head.sha)}`,
      token,
      requestOptions
    )
  ]);

  const peerFiles = await mapWithConcurrency(
    peers.filter((peer) => peer.number !== prNumber),
    concurrency,
    async (peer) => {
      const peerUrl = `${repoUrl}/pulls/${peer.number}`;
      const listedPeerIdentity = snapshotIdentity(peer);
      const peerDetail = (await requestJson(peerUrl, token, requestOptions)).data;
      const peerIdentity = snapshotIdentity(peerDetail);
      const changed = await requestAll(`${peerUrl}/files?per_page=100`, token, requestOptions);
      const peerAfter = (await requestJson(peerUrl, token, requestOptions)).data;
      return {
        number: peer.number,
        title: peerDetail.title ?? peer.title ?? '',
        files: changed.map((file) => file.filename),
        revision_consistent:
          sameRevision(listedPeerIdentity, peerIdentity) && sameSnapshot(peerIdentity, snapshotIdentity(peerAfter)),
        ...summarizeFileInventory(peerDetail, changed)
      };
    }
  );

  const currentAfter = (await requestJson(prUrl, token, requestOptions)).data;

  return {
    currentPr: {
      number: resolvedPr.number,
      base: resolvedPr.base.ref,
      head: resolvedPr.head.sha,
      mergeable: resolvedPr.mergeable,
      files: files.map((file) => file.filename),
      revision_consistent:
        mergeabilityIdentityConsistent && sameSnapshot(initialIdentity, snapshotIdentity(currentAfter)),
      ...summarizeFileInventory(resolvedPr, files)
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
  for (const snapshot of result.inconsistent_snapshots) {
    lines.push(`revision changed during scan PR #${snapshot.number}: ${snapshot.kind}`);
  }
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
