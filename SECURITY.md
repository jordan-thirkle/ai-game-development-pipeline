# Security Policy

## Supported scope

This repository contains research infrastructure, reusable game-development components, and prototype implementations. Security issues affecting reusable tooling, build scripts, CI, supply-chain integrity, secrets handling, networked prototypes, or published games derived from this work are in scope.

## Reporting

Do not open a public issue for an exploitable vulnerability, leaked secret, credential, or private user data. Use GitHub's private vulnerability reporting/security advisory flow when available for this repository.

If private reporting is unavailable, contact the repository owner through a non-public channel before disclosing technical exploitation details.

## Rules for experiments

- Never commit API keys, signing credentials, tokens, private certificates, or production secrets.
- Treat third-party assets, generated files, and model outputs as untrusted inputs until validated.
- Pin or otherwise make critical build dependencies reproducible where practical.
- Networked prototypes must document authentication, trust boundaries, and abuse risks before public release.
- Public benchmark data must not contain private telemetry or user-identifying information.

Security findings take precedence over benchmark scores and publication deadlines.
