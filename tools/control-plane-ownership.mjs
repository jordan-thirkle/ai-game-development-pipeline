const ownedPrefix = (pattern) => {
  if (typeof pattern !== 'string' || !pattern.endsWith('/**')) return null;
  return pattern.slice(0, -3).replace(/\/$/, '');
};

export const pathMatchesOwnedPattern = (filename, pattern) => {
  const prefix = ownedPrefix(pattern);
  if (!prefix || typeof filename !== 'string') return false;
  return filename === prefix || filename.startsWith(`${prefix}/`);
};

const matchWorkstream = (state, pull) => {
  const files = Array.isArray(pull.files) ? pull.files : [];
  const matches = state.workstreams.filter((workstream) =>
    files.some(({ filename }) =>
      workstream.ownedPaths.some((pattern) => pathMatchesOwnedPattern(filename, pattern)),
    ),
  );

  if (matches.length > 1) {
    throw new Error(
      `PR #${pull.number} overlaps multiple workstreams: ${matches.map(({ id }) => id).join(', ')}`,
    );
  }

  return matches[0] ?? null;
};

export const deriveOpenPullClaims = (state, pulls) => {
  const claims = new Map();

  for (const pull of pulls) {
    const workstream = matchWorkstream(state, pull);
    if (!workstream) continue;

    if (claims.has(workstream.id)) {
      const prior = claims.get(workstream.id);
      throw new Error(
        `Workstream ${workstream.id} has multiple open PR owners: #${prior.number} and #${pull.number}`,
      );
    }

    claims.set(workstream.id, pull);
  }

  return claims;
};

const expectedClaim = (pull) => ({
  sessionId: `github-pr:${pull.number}`,
  branch: pull.head.ref,
  base: pull.base.ref,
});

export const auditOwnershipProjection = (state, pulls) => {
  const claims = deriveOpenPullClaims(state, pulls);
  const drift = [];

  for (const workstream of state.workstreams) {
    const pull = claims.get(workstream.id);
    if (!pull) {
      if (workstream.sessionId.startsWith('github-pr:')) {
        drift.push({
          workstreamId: workstream.id,
          kind: 'closed-or-missing-pr-claim',
          actual: {
            sessionId: workstream.sessionId,
            branch: workstream.branch,
            base: workstream.base,
          },
          expected: null,
        });
      }
      continue;
    }

    const expected = expectedClaim(pull);
    if (
      workstream.sessionId !== expected.sessionId ||
      workstream.branch !== expected.branch ||
      workstream.base !== expected.base
    ) {
      drift.push({
        workstreamId: workstream.id,
        kind: 'open-pr-ownership-mismatch',
        pullNumber: pull.number,
        actual: {
          sessionId: workstream.sessionId,
          branch: workstream.branch,
          base: workstream.base,
        },
        expected,
      });
    }
  }

  return { claims, drift };
};

export const projectOwnership = (state, pulls, projectedAt) => {
  const { claims } = auditOwnershipProjection(state, pulls);
  const next = structuredClone(state);

  next.ownershipProjectedAt = projectedAt;
  next.workstreams = next.workstreams.map((workstream) => {
    const pull = claims.get(workstream.id);
    if (!pull) return workstream;

    const expected = expectedClaim(pull);
    return {
      ...workstream,
      ...expected,
      status: workstream.status === 'planned' ? 'claimed' : workstream.status,
    };
  });

  return next;
};
