# AI Game Asset Production Systems — 2026-08

Status: living research companion to `AI-GAME-DEV-LANDSCAPE-2026-08.md`  
Last verified: **2026-08-20T01:48:00+01:00** (`Europe/London` project time)  
Materialized records: `../registry/ai-game-dev-systems.v1.json`

## Core rule

An AI-generated image, mesh, sound or animation is **not automatically a game-ready asset**.

The pipeline must separate:

1. **intent/reference** — what the creator wants and what source material is permitted;
2. **generation provider/model** — the system that produces candidate media;
3. **workflow/orchestration** — reproducible parameters, nodes, seeds, transforms and retries;
4. **production conversion** — topology, UVs, materials, rigging, scale, pivots, collision, LODs, texture compression, audio normalization, sprite packing, etc.;
5. **provenance/licensing** — source, licence, model/tool/version, references, transformations and hashes;
6. **game validation** — import into the target engine, visual QA, runtime/performance/memory budgets and platform compatibility;
7. **art approval** — style, quality and fit;
8. **licence/legal approval** — a separate blocking decision whenever usage rights are unresolved or require human interpretation.

Art approval MUST NOT satisfy a licence/legal gate.

The Game Development OS should expose these as one creator experience while preserving each boundary underneath.

---

# 1. Asset workflow/orchestration

## ComfyUI

**Entry ID:** `asset.comfyui`  
Repository: https://github.com/Comfy-Org/ComfyUI  
Pinned revision: `5ab2f7a2d676c1fb7b410c22e82e2ed8f217b56c`  
Pinned source paths: repository root/README and `LICENSE` at that revision  
Licence: GPL-3.0 for the repository at the pinned revision; individual nodes/models/workflows require their own records  
Evidence: **SOURCE-VERIFIED**  
Disposition: **INCUMBENT workflow-engine candidate / BENCHMARK NOW as external adapter**

Pinned repository state was checked at `2026-08-20T01:48:00+01:00`. The repository metadata identifies `master` as the default branch and the pinned commit was authored on 2026-08-19. Its documented role is a node-graph workflow engine/API/backend spanning multiple generative-media model workflows.

### Why it matters

ComfyUI already solves a large amount of model orchestration, graph execution and ecosystem integration. Building an in-house model-node runtime would need a strong measured reason.

### Integration stance

- Treat ComfyUI as a **replaceable external workflow provider**, not the canonical asset data model.
- Store workflow graph/revision, model identifiers, seeds/parameters, inputs and output hashes in our provenance ledger.
- Build Creator Mode forms/actions on top of validated templates rather than exposing the full graph to beginners.
- Pro Mode may reveal/open the underlying graph.
- Because the repository is GPL-3.0, embedding/distribution is a **separate human licence-review gate**. An external/local service adapter is the preferred experiment shape until that review is complete.
- Custom nodes and model weights MUST be inventoried separately; the ComfyUI repository licence does not license every workflow dependency.

### Benchmark

Same asset brief through:
1. a fixed ComfyUI workflow;
2. a direct provider API;
3. one commercial integrated asset provider.

Measure reproducibility, setup cost, generation time, VRAM/cloud cost, provenance capture, failure recovery, style consistency and game-ready conversion work.

---

# 2. Open 3D generation baselines

## Microsoft TRELLIS

**Entry ID:** `asset.trellis`  
Repository: https://github.com/microsoft/TRELLIS  
Pinned root revision: `442aa1e1afb9014e80681d3bf604e8d728a86ee7`  
Pinned source paths: root `README.md`, root `LICENSE`, dependency/submodule declarations at that revision  
Evidence: **SOURCE-VERIFIED for the pinned root repository only**  
Disposition: **BENCHMARK NOW as open/local 3D baseline, production use blocked pending dependency/model-artifact inventory**

The root repository reports MIT licensing, but the project also contains/depends on submodules and model artifacts that can carry separate terms. Therefore this record deliberately does **not** generalize the root MIT licence across every artifact used by an experiment.

Documented capabilities include text/image-conditioned 3D generation and mesh/3D representations. Documented setup is GPU-heavy and primarily Linux/NVIDIA-oriented.

### Pipeline fit

TRELLIS is a useful open-control/quality baseline, but its hardware/runtime footprint means it may not be the default local Creator Mode path on ordinary laptops.

The adapter should be able to dispatch the same asset intent to:
- local capable workstation;
- remote GPU worker;
- commercial API provider;
while keeping canonical asset/provenance state unchanged.

### Required pre-experiment inventory

Before a TRELLIS-generated artifact can enter a benchmark or production candidate:
- pin every model artifact used;
- pin relevant submodules/dependencies;
- record each licence separately;
- record redistribution/commercial status;
- block use if any required licence is unresolved.

### Benchmark requirements

- image-to-3D and text/reference-to-3D quality;
- reproducibility under fixed seed/input where supported;
- GLB/mesh extraction quality;
- topology/UV/material cleanup needed before game import;
- scale/pivot/collision/LOD post-processing;
- VRAM, wall time and compute cost;
- import correctness in at least two benchmark runtimes;
- exact licence inventory for the concrete model/dependency/artifact set.

## Tencent Hunyuan3D-2

**Entry ID:** `asset.hunyuan3d2`  
Repository: https://github.com/Tencent-Hunyuan/Hunyuan3D-2  
Pinned revision: `f8db63096c8282cb27354314d896feba5ba6ff8a`  
Pinned licence path: `LICENSE` at that revision  
Evidence: **SOURCE-VERIFIED**  
Disposition: **REJECT AS DEFAULT FOR CURRENT UK PIPELINE pending exact version/component legal clearance**

Technical capabilities documented by the project include image/text-conditioned shape generation, separate texture generation and common mesh-output workflows.

### Critical licence finding

The pinned Hunyuan3D 2.0 Community License states territorial restrictions including that the agreement does not apply in the United Kingdom, European Union or South Korea.

Therefore:
- do not add this pinned model/repository state to the automatic UK commercial provider pool;
- do not let an agent infer "public GitHub repository" means commercially usable here;
- any different/newer Hunyuan3D artifact receives its **own exact licence/territory review**;
- wrappers do not cure upstream model restrictions.

This is a mandatory negative conformance case: provider selection for a UK commercial target must refuse the pinned artifact before generation and explain why.

---

# 3. Commercial provider adapters

## Meshy

**Entry ID:** `asset.meshy`  
Evidence: **VENDOR-CLAIM; not independently executed by ByJTT**  
Disposition: **BENCHMARK NOW as commercial 3D-production baseline**

Vendor sources captured for the current research snapshot:
- https://docs.meshy.ai/en/webapp/guides/use-cases/game-assets
- https://docs.meshy.ai/en
- https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models
- https://help.meshy.ai/en/articles/16102098-can-i-use-meshy-assets-commercially

The vendor documents capabilities around 3D generation, texturing/PBR-oriented workflows, rigging/animation and game-engine import. Terms/output rights are plan- and input-dependent and MUST be re-read at generation time.

### Benchmark role

Compare on **game-ready accepted-asset total cost**, not screenshot appeal:
- creator time to acceptable asset;
- geometry/topology cleanup;
- textures/materials;
- rigging/animation usability;
- LOD/collision requirements;
- engine import;
- API latency/cost;
- exact commercial/output rights for the selected plan and source inputs;
- reproducibility/provenance metadata available through the API.

## Scenario

**Entry ID:** `asset.scenario`  
Evidence: **VENDOR-CLAIM; not independently executed by ByJTT**  
Disposition: **BENCHMARK NOW for style-consistent production workflows**

Vendor sources captured for the current research snapshot:
- https://www.scenario.com/platform
- https://docs.scenario.com/get-started/training/training-models/
- https://www.scenario.com/features/workflows
- https://help.scenario.com/articles/8779329416-content-policy-copyright-what-each-model-allows

Vendor materials position Scenario around model/style training, repeatable workflows and multiple media/provider integrations. Exact model-provider terms are not uniform and must be recorded per workflow.

### Benchmark role

Do not compare only one generated hero image. Test a **small production set**:
- same character across poses/expressions;
- environment/prop family consistency;
- UI/marketing asset variants;
- iteration after art-direction feedback;
- provenance/metadata capture;
- cost per accepted asset, not cost per generation.

---

# 4. Production post-processing incumbent

## Blender

Disposition: **INCUMBENT general 3D conversion/inspection/post-processing layer unless a target engine solves the step better**

Even when generation comes from TRELLIS, Meshy, Scenario or another provider, the pipeline needs a stable post-processing/inspection layer for operations such as:
- geometry inspection/repair;
- scale, origin and transforms;
- UV/material validation;
- retopology/decimation where required;
- rig/animation inspection;
- collision proxy generation;
- LOD preparation;
- GLB/glTF/FBX interchange;
- automated renders/turntables for visual QA.

The specific Blender automation/agent bridge should be separately researched; the standard should depend on capabilities and open interchange, not one MCP implementation.

---

# 5. Mandatory asset provenance/conformance record

A normalized asset record is **mandatory at generation or import time**, before the output is used by an experiment. It is not deferred until production promotion.

At minimum it must carry:

```text
asset_id
intent_id
source_url_or_repository
source_revision
source_author_or_publisher
provider_id
provider_version
model_id
model_version
workflow_id
workflow_revision
seed_or_determinism_info
input_asset_refs
prompt_or_structured_intent
started_at
completed_at
compute_location
cost
raw_output_hashes
accepted_output_hashes
licence_id
licence_source
territory
commercial_use_status
source_attribution_requirements
modification_history
experiment_ids
validation_results
redistribution_status
generator_metadata
art_approval_status
art_approval_reviewer
art_approval_at
licence_review_status
licence_review_reviewer
licence_review_decided_at
licence_blocking_reason
engine_import_results
performance_results
```

This record extends, and MUST remain compatible with, `registry/PROVENANCE.md`.

### Provenance completeness

`provenance_complete=true` is permitted only when all fields required by the asset's source/use path are present, including stable identity, source/revision, author/publisher, licence/commercial status, attribution, modifications, experiment linkage, validation, redistribution state, and generator/source metadata.

Missing required provenance blocks:
- use in a benchmark as an accepted input/output;
- promotion to `production_candidate`;
- redistribution/publishing;
- claims about commercial readiness.

Raw quarantined outputs may be retained solely for investigation if clearly marked `provenance_incomplete` and cannot be consumed downstream.

### Pre-generation/import gate

Before generation or third-party import:
- intended commercial/non-commercial use known;
- intended territories/platforms known where licences require it;
- provider/model/source licence identified;
- reference/input ownership known;
- estimated cost within budget;
- sensitive/private source handling acceptable;
- mandatory provenance record allocated;
- unresolved legal/licensing ambiguity sets `licence_review_status=blocked` and prevents execution when human review is required.

### Separate approval gates

**Art approval** covers style, quality, identity/consistency and fit.

**Licence/legal approval** covers unresolved usage rights, territory, attribution, commercial terms and redistribution. It has its own reviewer and decision timestamp. An art director approval cannot satisfy it.

When licence terms are straightforward and machine-verifiable, the automated gate can record `licence_review_status=machine_cleared`. If terms are ambiguous/material, status remains `blocked_pending_human_review` until a human decision is recorded.

### Post-generation gate

Before an asset becomes `production_candidate`:
- output file parses;
- provenance is complete;
- licence/legal status is compatible and not blocked;
- art-direction review complete;
- engine import succeeds;
- scale/pivot/material expectations pass;
- runtime memory/performance is within relevant budget;
- collision/rig/animation/LOD requirements are satisfied where applicable.

---

# 6. Creator Mode implication

A beginner should not have to choose between TRELLIS, ComfyUI, Meshy or a future provider to create a prop.

Creator Mode should ask for **intent**:

> "Make a weathered wooden market stall that matches this village."

The asset orchestrator then chooses/compares **eligible** providers based on:
- required modality;
- current benchmark quality;
- style consistency;
- licence/territory eligibility;
- privacy;
- local hardware;
- time/cost budget;
- target engine/platform requirements.

Pro Mode can reveal and override provider/model/workflow choices, but cannot bypass mandatory provenance or unresolved legal gates without an explicitly recorded human decision.

This is another portability boundary: **creator intent is canonical; provider output is replaceable**.

# Immediate experiments

1. **ComfyUI template adapter spike** — structured intent → fixed graph → mandatory provenance → output artifact.
2. **TRELLIS game-ready spike** — first complete dependency/model licence inventory, then reference image → mesh → Blender normalization → GLB → two engine imports → runtime/memory measurements.
3. **Meshy comparison** — same asset brief through the commercial path; record current plan/output terms and accepted-asset total cost/time.
4. **Style consistency set** — choose one 2D/character provider workflow and generate a multi-asset family, not a cherry-picked image.
5. **Licence rejection test** — feed pinned Hunyuan3D-2 into provider selection for a UK commercial target and assert refusal before generation.
6. **Provenance round-trip** — generated/imported asset through at least two tools and verify source/licence/transformation history survives to the shipped build manifest.
