# Research Intelligence Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a low-maintenance, evidence-backed publication system that turns verified research, benchmarks and trend signals into consistent first-party content across By JTT, games.byjtt.com and design.byjtt.com without fragmenting the underlying knowledge graph.

**Architecture:** Keep GitHub/research evidence as the canonical source of truth. Add a content knowledge model that references evidence, sources, entities, topics, verticals, freshness and publication state; render the same content object through vertical-specific site surfaces while preserving one canonical URL. Automate drafting, metadata, internal-link suggestions, social copy, image manifests, freshness detection and publication QA, while fail-closing on unsupported claims, ambiguous provenance/licensing and insufficient evidence.

**Tech Stack:** Existing repository schemas and Node/JavaScript tooling; JSON Schema for machine-readable contracts; existing studio/control-plane conventions; GitHub as canonical project state; downstream Astro/site repositories remain adapters rather than duplicated content stores.

**Spec:** Product/design decisions approved in the 2026-08-27 Research & Intelligence Engine conversation; existing `AGENTS.md`, `docs/PIPELINE.md`, `docs/PUBLISHING.md`, `docs/MULTI-AGENT-OPERATING-MODEL.md`, and evidence/pipeline schemas.

## Global Constraints

- GitHub issues/PRs/commits are canonical project state; chat history is not.
- Research must use current primary sources for fast-moving claims and must record failed attempts and incompatibilities.
- Code inspection alone cannot prove runtime, gameplay, rendering, engine, browser, device, performance or release behaviour.
- External reuse must fail closed on ambiguous licence/provenance.
- Published claims must remain traceable to evidence and source revisions.
- Human approval remains required for irreversible public releases, unresolved legal/licensing ambiguity, commercially sensitive publication and other meaningful irreversible actions.
- Prefer solved systems and existing repository primitives before bespoke infrastructure.
- Automated publication must never invent evidence, statistics, quotations, tests, citations or capabilities.

---

### Task 1: Define the publication knowledge contract

**Files:**
- Create: `schemas/publication.schema.json`
- Create: `schemas/publication-claim.schema.json`
- Create: `docs/RESEARCH-PUBLICATION-ENGINE.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: existing evidence identifiers, pipeline events, research decisions and repository revisions.
- Produces: stable publication objects with `id`, `canonicalUrl`, `title`, `type`, `verticals`, `topics`, `audience`, `claims`, `sources`, `evidenceIds`, `publishedAt`, `updatedAt`, `lastVerifiedAt`, `nextReviewAt`, `status`, `imageManifest`, `shareVariants` and `relatedContent`.

- [ ] **Step 1: Write the failing schema fixtures** for a valid research article, a benchmark report, a guide, a trend report, and an unsupported claim that must fail validation.
- [ ] **Step 2: Run the repository's existing schema validation command and confirm the new fixtures fail before the schemas exist.**
- [ ] **Step 3: Implement the publication and claim JSON Schemas.** Require evidence/source references for factual claims, explicit publication status, canonical identity and freshness metadata; distinguish `draft`, `review`, `published`, `superseded` and `held`.
- [ ] **Step 4: Validate the fixtures and confirm unsupported claims fail closed.**
- [ ] **Step 5: Document the contract and update `AGENTS.md` with the publication-source-of-truth rule.**
- [ ] **Step 6: Commit the schema/contract change.**

### Task 2: Build the shared taxonomy and vertical routing model

**Files:**
- Create: `config/editorial-taxonomy.json`
- Create: `schemas/editorial-taxonomy.schema.json`
- Create: `docs/EDITORIAL-TAXONOMY.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: publication objects.
- Produces: domain, discipline, technology, content-type and audience classifications plus public surfaces for `games`, `design` and `development`.

- [ ] **Step 1: Write taxonomy fixtures covering AI game development, web design, web development, app development, software development, vibe coding, MCP, benchmarks and trends.**
- [ ] **Step 2: Validate the taxonomy fixtures and confirm missing/duplicate identifiers fail.**
- [ ] **Step 3: Implement the taxonomy with shared concepts and vertical projections; do not duplicate articles merely because they appear in multiple verticals.**
- [ ] **Step 4: Document canonical URL versus vertical presentation rules.**
- [ ] **Step 5: Run validation and commit.**

### Task 3: Add source/trend signal ingestion contracts

**Files:**
- Create: `schemas/research-signal.schema.json`
- Create: `config/research-sources.json`
- Create: `docs/RESEARCH-SIGNAL-RADAR.md`

**Interfaces:**
- Consumes: official documentation/release sources, GitHub, Reddit discussions, X/public social signals, specialist communities, standards bodies and research publications.
- Produces: normalized signals containing source type, source URL/reference, observed date, topic/entity candidates, summary, confidence, novelty and verification state.

- [ ] **Step 1: Define fixtures for an official release, a Reddit discussion, an X signal, a GitHub release and a standards update.**
- [ ] **Step 2: Validate fixtures and reject signals without source identity/date.**
- [ ] **Step 3: Implement the normalized signal schema and source policy.** Reddit/X/community material is a lead or sentiment signal unless independently verified; primary documentation remains authoritative for capability claims.
- [ ] **Step 4: Add deduplication fields and `verificationState` so repeated social discussion does not automatically create repeated articles.**
- [ ] **Step 5: Validate and commit.**

### Task 4: Implement claim/evidence freshness and article update decisions

**Files:**
- Create: `schemas/content-review.schema.json`
- Create: `scripts/content-review.mjs`
- Create: `docs/CONTENT-FRESHNESS.md`

**Interfaces:**
- Consumes: publication objects, claims, evidence, source timestamps and research signals.
- Produces: `no_change`, `update`, `supersede`, `hold` or `human_review` decisions with reasons and affected claims.

- [ ] **Step 1: Write fixtures for fresh evidence, stale evidence, contradicted evidence and an unchanged article.**
- [ ] **Step 2: Run the review script against fixtures and confirm the expected decisions fail before implementation.**
- [ ] **Step 3: Implement deterministic freshness evaluation using explicit `reviewAfter`/`nextReviewAt`, source change signals and claim-level evidence dependencies.**
- [ ] **Step 4: Ensure progress, source discovery or social activity never becomes proof of a changed capability without verification.**
- [ ] **Step 5: Emit machine-readable review decisions suitable for CI and agent consumption.**
- [ ] **Step 6: Validate and commit.**

### Task 5: Add article rendering and SEO metadata contracts

**Files:**
- Create: `schemas/article-render.schema.json`
- Create: `docs/ARTICLE-STYLE-GUIDE.md`
- Create: `config/article-templates.json`

**Interfaces:**
- Consumes: validated publication objects and taxonomy.
- Produces: consistent article presentation data including title/dek, byline, publication/update timestamps, reading time, hero/evidence imagery, headings, source section, related content, breadcrumbs, canonical URL, Open Graph/share variants and appropriate structured-data descriptors.

- [ ] **Step 1: Write representative article fixture snapshots for research, guide, benchmark and trend formats.**
- [ ] **Step 2: Validate required metadata and reject articles missing canonical identity, dates or source/evidence state.**
- [ ] **Step 3: Implement template definitions with a common visual grammar and type-specific sections.**
- [ ] **Step 4: Document image, citation, heading, table, callout, source, correction and update conventions.**
- [ ] **Step 5: Add explicit machine-readable answer/claim/evidence fields so agents can consume articles without scraping presentation prose.**
- [ ] **Step 6: Validate and commit.**

### Task 6: Build automated internal linking and related-content selection

**Files:**
- Create: `schemas/content-link.schema.json`
- Create: `scripts/content-links.mjs`
- Create: `docs/CONTENT-LINKING.md`

**Interfaces:**
- Consumes: publication objects, taxonomy, entities, claims and canonical URLs.
- Produces: contextual internal-link recommendations with reason, anchor text, target, relationship and confidence.

- [ ] **Step 1: Create fixtures for direct topic relationships, entity relationships, prerequisite guides and benchmark-to-standard relationships.**
- [ ] **Step 2: Confirm the linker rejects links to superseded/held content unless explicitly permitted.**
- [ ] **Step 3: Implement deterministic candidate scoring from shared taxonomy/entity relationships before optional semantic ranking.**
- [ ] **Step 4: Prevent self-links, duplicate links and contradictory recommendations.**
- [ ] **Step 5: Validate and commit.**

### Task 7: Add image and social distribution manifests

**Files:**
- Create: `schemas/article-media.schema.json`
- Create: `schemas/share-variants.schema.json`
- Create: `docs/ARTICLE-MEDIA-AND-SHARING.md`

**Interfaces:**
- Consumes: publication objects and article templates.
- Produces: image requirements/provenance records and platform-specific share copy for X, LinkedIn, Reddit, Facebook and generic copy/citation flows.

- [ ] **Step 1: Define fixtures for hero art, evidence screenshot, diagram, benchmark graphic and generated social-card variants.**
- [ ] **Step 2: Reject media records without alt text and source/licence/provenance state where the asset is externally sourced or generated.**
- [ ] **Step 3: Implement deterministic share-variant generation from the article answer/key findings rather than invented claims.**
- [ ] **Step 4: Ensure Reddit share copy is discussion-oriented and never presents community claims as first-party facts.**
- [ ] **Step 5: Validate and commit.**

### Task 8: Integrate publication into the existing pipeline/control plane

**Files:**
- Modify: `schemas/pipeline-event.schema.json`
- Modify: `schemas/control-plane-state.schema.json`
- Create: `docs/RESEARCH-PUBLICATION-PIPELINE.md`

**Interfaces:**
- Consumes: validated research findings, publication review decisions and article manifests.
- Produces: auditable events for `publication.proposed`, `publication.validated`, `publication.published`, `publication.updated`, `publication.superseded` and `publication.held` plus control-plane publication state.

- [ ] **Step 1: Add event fixtures for proposed, validated, published, updated, superseded and held transitions.**
- [ ] **Step 2: Confirm unknown publication events fail schema validation before implementation.**
- [ ] **Step 3: Add publication event types and state projections without weakening existing event invariants.**
- [ ] **Step 4: Add evidence IDs, repository revision and correlation/causation metadata to publication events.**
- [ ] **Step 5: Validate all existing pipeline fixtures plus the new publication fixtures.**
- [ ] **Step 6: Commit.**

### Task 9: Create the first content corpus from existing verified research

**Files:**
- Create: `content/research/ai-game-development-pipeline.md`
- Create: `content/research/creator-pro-mode-continuity.md`
- Create: `content/research/mcp-game-development.md`
- Create: `content/guides/vibe-coding-game-development.md`
- Create: `content/research/ai-game-assets-production-readiness.md`
- Create: `content/benchmarks/index.md`

**Interfaces:**
- Consumes: existing verified research and evidence references; no new claims without source/evidence records.
- Produces: the initial publication corpus proving the system can turn existing research into public-ready content.

- [ ] **Step 1: Select only research findings whose source/evidence status is current enough for publication.**
- [ ] **Step 2: Draft articles using the common article contract and explicit evidence/source mapping.**
- [ ] **Step 3: Add cross-vertical contextual relationships without duplicating canonical articles.**
- [ ] **Step 4: Run publication QA for claims, links, metadata, accessibility and freshness.**
- [ ] **Step 5: Commit the corpus.**

### Task 10: Connect downstream public site adapters and verify end-to-end publication

**Files:**
- Modify: existing public-site adapter/configuration discovered in the target site repositories after reload.
- Create: `docs/PUBLICATION-ADAPTER-CONTRACT.md`
- Test: end-to-end publication fixture/CI path in the owning site repository.

**Interfaces:**
- Consumes: canonical publication objects from the research engine.
- Produces: rendered pages on the appropriate By JTT vertical with canonical metadata, structured data, internal links, share controls, dates and freshness state.

- [ ] **Step 1: Reload the target By JTT, games and design repositories and identify their current content build/deploy conventions before modifying them.**
- [ ] **Step 2: Write an adapter fixture proving one canonical article can render on its selected vertical without content duplication.**
- [ ] **Step 3: Implement the smallest adapter that maps the shared publication contract into the existing site architecture.**
- [ ] **Step 4: Verify rendered HTML, canonical URL, metadata, JSON-LD, headings, links, image alt text and social metadata.**
- [ ] **Step 5: Verify one update propagates through the same content identity without creating a duplicate canonical article.**
- [ ] **Step 6: Run the owning site's full verification/build and commit.**

### Task 11: Add publication CI and low-maintenance operating documentation

**Files:**
- Create: `.github/workflows/publication-quality.yml`
- Create: `docs/RESEARCH-PUBLICATION-OPERATIONS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: changed publication/schema/content files and freshness decisions.
- Produces: deterministic validation results, publication reports and human-review queues only where policy requires them.

- [ ] **Step 1: Define CI fixtures for valid publication, missing evidence, stale evidence, broken internal link, invalid media provenance and missing canonical metadata.**
- [ ] **Step 2: Implement CI so routine valid content passes automatically and unsafe/unsupported publication blocks.**
- [ ] **Step 3: Generate a concise machine-readable report suitable for agent consumption and a human summary suitable for GitHub review.**
- [ ] **Step 4: Document the exception-only human workflow and how to resolve a held publication.**
- [ ] **Step 5: Run the complete verification suite and commit.**

### Task 12: Final adversarial review and evidence-gated promotion

**Files:**
- Modify: `docs/RESEARCH-PUBLICATION-ENGINE.md`
- Modify: `docs/superpowers/plans/2026-08-27-research-intelligence-engine.md`

**Interfaces:**
- Consumes: all implementation evidence, CI results and public-site render evidence.
- Produces: a promotion decision identifying verified capabilities, limitations, deferred adapters and remaining human gates.

- [ ] **Step 1: Run all repository verification commands defined by the current `AGENTS.md` and project tooling.**
- [ ] **Step 2: Review the implementation against the solved-system gate and remove bespoke components where an existing maintained solution now satisfies the requirement.**
- [ ] **Step 3: Verify at least one research finding flows from evidence to publication metadata to rendered public content and one freshness change produces an update/hold decision.**
- [ ] **Step 4: Record exact revisions, timestamps and evidence IDs for the verified path.**
- [ ] **Step 5: Commit final documentation and open a PR; do not merge or claim production readiness until required checks pass.**
