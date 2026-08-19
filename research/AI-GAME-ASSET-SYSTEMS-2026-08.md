# AI Game Asset Production Systems — 2026-08

Status: living research companion to `AI-GAME-DEV-LANDSCAPE-2026-08.md`  
Last verified: **2026-08-20**

## Core rule

An AI-generated image, mesh, sound or animation is **not automatically a game-ready asset**.

The pipeline must separate:

1. **intent/reference** — what the creator wants and what source material is permitted;
2. **generation provider/model** — the system that produces candidate media;
3. **workflow/orchestration** — reproducible parameters, nodes, seeds, transforms and retries;
4. **production conversion** — topology, UVs, materials, rigging, scale, pivots, collision, LODs, texture compression, audio normalization, sprite packing, etc.;
5. **provenance/licensing** — source, licence, model/tool/version, references, transformations and hashes;
6. **game validation** — import into the target engine, visual QA, runtime/performance/memory budgets and platform compatibility;
7. **human approval** — style, quality and fit.

The Game Development OS should expose these as one creator experience while preserving each boundary underneath.

---

# 1. Asset workflow/orchestration

## ComfyUI

Repository: https://github.com/Comfy-Org/ComfyUI  
Licence: GPL-3.0  
Evidence: **SOURCE-VERIFIED**  
Disposition: **INCUMBENT workflow-engine candidate / BENCHMARK NOW as external adapter**

Repository snapshot checked 2026-08-20:
- ~128k GitHub stars / ~15k forks;
- actively pushed on 2026-08-19;
- Python;
- node-graph workflow engine with API/backend;
- project documentation positions it across image, video, 3D, audio and other model workflows;
- sophisticated workflows can be exposed through simpler app-style interfaces.

### Why it matters

ComfyUI already solves a huge amount of model orchestration, reproducible graph execution and ecosystem integration. Building an in-house model-node runtime would need a very strong measured reason.

### Integration stance

- Treat ComfyUI as a **replaceable external workflow provider**, not the canonical asset data model.
- Store the workflow graph/version, model identifiers, seeds/parameters, inputs and output hashes in our provenance ledger.
- Build Creator Mode forms/actions on top of validated templates rather than exposing a giant node graph to beginners.
- Pro Mode may link/open the underlying graph for expert control.
- Because ComfyUI itself is GPL-3.0, embedding/distribution strategy requires explicit licence review. Calling a separately operated/local service through an adapter has a different legal/architectural profile from incorporating its code.

### Benchmark

Same asset brief through:
1. a fixed ComfyUI workflow;
2. a direct provider API;
3. one commercial integrated asset provider.

Measure reproducibility, setup cost, generation time, VRAM/cloud cost, provenance capture, failure recovery, style consistency and game-ready conversion work.

---

# 2. Open 3D generation baselines

## Microsoft TRELLIS

Repository: https://github.com/microsoft/TRELLIS  
Licence: MIT for models and majority of code; repository notes some submodules carry their own licences  
Evidence: **SOURCE-VERIFIED**  
Disposition: **BENCHMARK NOW as permissive local/open 3D baseline**

Repository snapshot checked 2026-08-20:
- ~13.4k stars / ~1.3k forks;
- official Microsoft research implementation;
- text or image → 3D;
- outputs can include radiance fields, 3D Gaussians and meshes;
- supports asset variants/local editing;
- training code and pretrained models are public.

Practical constraints in project documentation:
- primarily tested on Linux;
- NVIDIA GPU with at least 16 GB memory required for the documented setup;
- CUDA/toolchain dependencies.

### Pipeline fit

TRELLIS is a useful **quality/open-control baseline**, but its hardware/runtime footprint means it may not be the default local Creator Mode path on ordinary laptops.

The adapter should be able to dispatch the same asset intent to:
- local capable workstation;
- remote GPU worker;
- commercial API provider;
while keeping the canonical asset/provenance contract unchanged.

### Benchmark requirements

- image-to-3D and text/reference-to-3D quality;
- reproducibility under fixed seed/input;
- GLB/mesh extraction quality;
- topology/UV/material cleanup needed before game import;
- scale/pivot/collision/LOD post-processing;
- VRAM, wall time and compute cost;
- import correctness in at least two benchmark runtimes;
- exact licence inventory for used submodules/model artifacts.

## Tencent Hunyuan3D-2 repository family

Repository: https://github.com/Tencent-Hunyuan/Hunyuan3D-2  
Evidence: **SOURCE-VERIFIED**  
Disposition: **REJECT AS DEFAULT FOR CURRENT UK PIPELINE pending exact version/component legal clearance**

Technical capabilities documented by the project include:
- image/text-conditioned shape generation;
- separate texture generation;
- GLB/OBJ-compatible mesh output;
- local code, API server, Gradio and Blender-addon workflows;
- multiview and texture workflows;
- newer model work including PBR-related pipelines.

### Critical licence finding

The repository's Hunyuan3D 2.0 Community License states that the agreement **does not apply in the European Union, United Kingdom or South Korea**.

Therefore:
- do not add this repository/model family to the automatic UK commercial asset provider pool;
- do not let an agent infer "open source on GitHub" means commercially usable here;
- any newer Hunyuan3D component/version must receive its **own exact licence/territory review** before use;
- community wrappers do not cure upstream model licence restrictions.

This becomes a test case for the provenance/licensing subsystem: provider selection should be capable of rejecting a technically strong model **before generation** because the intended territory/use is incompatible.

---

# 3. Commercial provider adapters

## Meshy

Evidence: **VENDOR/SOURCE-VERIFIED, not yet independently benchmarked**  
Disposition: **BENCHMARK NOW as commercial 3D-production baseline**

Relevant vendor-positioned capabilities include 3D generation, texturing/PBR-oriented workflows, rigging/animation and engine integrations.

### Benchmark role

Compare against local/open baselines on **game-ready total cost**, not screenshot appeal:
- creator time to acceptable asset;
- geometry/topology cleanup;
- textures/materials;
- rigging/animation usability;
- LOD/collision requirements;
- engine import;
- API latency/cost;
- commercial terms and output rights;
- reproducibility/provenance information available through the API.

## Scenario

Evidence: **VENDOR/SOURCE-VERIFIED, not yet independently benchmarked**  
Disposition: **BENCHMARK for style-consistent production workflows**

Scenario is particularly relevant to consistency/custom-model and multi-media production workflows.

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

The specific Blender automation/agent bridge should be separately researched; the standard should depend on **capabilities and open interchange**, not one MCP implementation.

---

# 5. Asset-provider conformance contract

Every asset provider adapter SHOULD eventually expose a normalized record similar to:

```text
intent_id
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
territory
commercial_use_status
source_attribution_requirements
transformation_history
human_approval
engine_import_results
performance_results
```

### Pre-generation gate

Before generation:
- intended commercial/non-commercial use known;
- intended territories/platforms known where licences require it;
- provider/model licence known;
- reference/input ownership known;
- estimated cost within budget;
- sensitive/private source handling acceptable.

### Post-generation gate

Before an asset becomes `production_candidate`:
- output file parses;
- provenance record complete;
- licence is compatible;
- visual/art-direction review complete;
- engine import succeeds;
- scale/pivot/material expectations pass;
- runtime memory/performance is within relevant budget;
- collision/rig/animation/LOD requirements are satisfied where applicable.

---

# 6. Creator Mode implication

A beginner should not have to choose between "TRELLIS", "ComfyUI", "Meshy" or a future provider to create a prop.

Creator Mode should ask for **intent**:

> "Make a weathered wooden market stall that matches this village."

The asset orchestrator then chooses/compares eligible providers based on:
- required modality;
- current benchmark quality;
- style consistency;
- licence/territory eligibility;
- privacy;
- local hardware;
- time/cost budget;
- target engine/platform requirements.

Pro Mode can reveal and override provider/model/workflow choices.

This is another important portability boundary: **creator intent is canonical; provider output is replaceable**.

# Immediate experiments

1. **ComfyUI template adapter spike** — structured intent → fixed graph → captured provenance → output artifact.
2. **TRELLIS game-ready spike** — reference image → mesh → Blender normalization → GLB → two engine imports → runtime/memory measurements.
3. **Meshy comparison** — same asset brief through commercial path; measure accepted-asset total cost/time.
4. **Style consistency set** — choose one 2D/character provider workflow and generate a multi-asset family, not a single cherry-picked image.
5. **Licence rejection test** — feed Hunyuan3D-2.0 into provider selection for a UK commercial target and assert the pipeline refuses it with a clear reason before generation.
6. **Provenance round-trip** — edit/generated asset through at least two tools and verify source/licence/transformation history survives to the shipped build manifest.
