# Public Repository Data Policy

This repository is intentionally public. Treat every committed byte, branch, pull request, issue, workflow log, and retained artifact as potentially visible to third parties.

## Public by design

The following belong in the repository when they are required to reproduce, review, or understand the project:

- source code and schemas;
- public architecture and standards documentation;
- reproducible test fixtures that contain no real credentials or personal data;
- GitHub Actions configuration and security policy;
- benchmark contracts, deterministic inputs, and intentionally curated evidence;
- public provenance, licensing, and dependency metadata.

## Local or generated only

Do not commit transient machine state, caches, generated build output, local databases, browser test output, uncurated screenshots/recordings, temporary evidence, editor state, or local deployment-provider metadata. `.gitignore` is the first guardrail, not the security boundary.

## Never commit

- passwords, API keys, access tokens, refresh tokens, private keys, signing keys, certificates containing private material, or credential files;
- `.env` files other than documented placeholder examples;
- provider account exports or local deployment state;
- personal data, private correspondence, customer/user records, private legal/security notes, or production logs containing identifiers;
- raw incident details that would materially help exploitation before remediation;
- private repository URLs, internal service credentials, or secrets copied into fixtures, tests, issues, PRs, workflow output, or documentation.

## Security controls

The repository must keep these controls green:

1. `tools/validate-public-exposure.mjs` scans the tracked tree for forbidden private/local paths and high-confidence credential formats.
2. `tools/scan-git-history-secrets.mjs` scans the complete fetched Git history for high-confidence credential formats, including material that was later deleted.
3. `.github/workflows/public-exposure-security.yml` runs both checks on every pull request and `main` push with read-only permissions and no persisted checkout credentials.
4. GitHub Action references are pinned to immutable commit SHAs under the existing GitHub configuration security contract.
5. CodeQL and dependency/security automation remain enabled where supported.

These checks reduce risk but are not proof that no secret exists. Human review remains required for unusual data, binary artifacts, screenshots, logs, provider files, and new credential formats.

## If a secret is exposed

Assume it is compromised immediately. Revoke or rotate it first. Then remove it from the current tree, assess logs/artifacts/issues/PRs for further disclosure, and rewrite Git history only when justified. History rewriting is cleanup, not credential revocation.

## Public/private architecture

If future work needs genuinely private operational state, store it in a separate private system or repository. Do not weaken this public repository's reproducibility by hiding ordinary source, schemas, tests, or public engineering evidence behind `.gitignore`.
