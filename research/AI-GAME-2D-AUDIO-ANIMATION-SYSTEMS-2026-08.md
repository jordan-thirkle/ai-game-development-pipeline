# AI Game 2D, Animation and Audio Systems — 2026-08

Status: **living research companion; no provider is EXECUTED by ByJTT merely by appearing here**  
Project time convention: `Europe/London`  
Registry authority: `../registry/ai-game-dev-systems.v1.json`  
Asset provenance authority: `../registry/PROVENANCE.md`

## Purpose

Extend the solved-system-first registry beyond 3D generation into production-critical **2D/sprite consistency, rigging/animation, sound effects, music and voice**.

The same rule applies throughout: open source code, downloadable weights, commercially usable outputs, reproducibility and game-ready production are separate properties. Every actual experiment requires a frozen benchmark/run manifest and complete provenance before accepted outputs can enter the pipeline.

---

# 1. 2D / sprite production

## PixelLab

Canonical sources:
- https://www.pixellab.ai/termsofservice
- https://www.pixellab.ai/docs/faq

Evidence: **VENDOR-CLAIM**  
Disposition: **BENCHMARK NOW as commercial pixel/sprite Creator Mode baseline**

The current vendor terms state that users own their creations and permit commercial/non-commercial output use. They also restrict using generated images to train models without written permission and require programmatic use through PixelLab's official API; service-building/resale scenarios need separate discussion with PixelLab.

### Why it matters

PixelLab is a useful benchmark for the creator-facing experience we ultimately want: a user should specify character/style/animation intent rather than manually orchestrate model calls and sprite post-processing.

### Required benchmark

Use one frozen character reference and palette to create a complete small production set:
- idle;
- walk/run;
- attack;
- hurt;
- death;
- one alternate facing/direction set where supported.

Measure:
- character identity/silhouette consistency;
- frame bounding-box/anchor drift;
- palette fidelity;
- alpha-edge crispness;
- animation loop closure/timing;
- atlas metadata correctness;
- editability after art-direction feedback;
- engine import in at least two benchmark runtimes;
- total cost/time per **accepted animation set**, not per generated image.

Terms must be re-read at experiment time because they are mutable vendor terms.

## SpriteForge

Repository: https://github.com/francesco-sodano/spriteforge  
Pinned revision: `547027105febecb86bff561709aabc77f9e35db2`  
Repository licence: MIT  
Evidence: **SOURCE-VERIFIED**  
Disposition: **REFERENCE + BENCHMARK deterministic sprite-pipeline patterns**

The project is a small AI spritesheet pipeline built around a base character plus configuration-driven animation rows and external Azure-hosted image generation. Its architectural value is greater than its adoption signal: declarative animation specs, deterministic assembly, verification/retry loops and run summaries are all patterns we can evaluate independently of the chosen image model.

### Licence boundary

The repository's MIT licence covers the repository code. It does **not** license Azure/OpenAI models, generated outputs, user reference images or other external services. Every provider/output remains a separate provenance record.

### Benchmark role

Compare its deterministic assembly/verification mechanics against our own provider-neutral sprite contract. Do not adopt an Azure dependency merely because the pipeline is useful.

## `ianlintner/ai-pixel-art-image-generation`

Repository: https://github.com/ianlintner/ai-pixel-art-image-generation  
Pinned revision: `19dbb4d5b655f8c4c0c8f979dd89baeb10237b0a`  
Repository licence: MIT  
Evidence: **SOURCE-VERIFIED**  
Disposition: **REFERENCE for agent-skill + deterministic QA architecture**

The repository packages pixel/sprite/tilemap generation as an agent skill and combines external image providers with deterministic post-processing/export. Particularly relevant ideas include:
- palette quantization and nearest-neighbor processing;
- sprite/tile workflows rather than isolated images;
- Tiled-compatible TSX/TMJ export;
- explicit QA metrics such as palette fidelity, alpha crispness, tile seams and animation alignment;
- provider abstraction across multiple external APIs.

The external providers/models named by the skill are **not licensed by this MIT repository licence**. Their exact versions, terms and output rights must be materialized separately before use.

### Standard consequence

2D asset conformance should include deterministic image-analysis checks alongside human art approval. A visually attractive sprite that drifts off-grid, changes palette unexpectedly or produces broken tile seams is not production-ready.

---

# 2. Rigging and animation

## UniRig

Repository: https://github.com/VAST-AI-Research/UniRig  
Pinned code revision: `6793c6640ff01c8fb389f3993434124bb43d2933`  
Official model repository: https://huggingface.co/VAST-AI/UniRig  
Pinned model-repository revision: `36842e2b5947e9e60f89275b83208c8e74071c63`  
Model-card licence at that revision: MIT  
Evidence: **SOURCE-VERIFIED**  
Disposition: **BENCHMARK NOW as open auto-rigging baseline**

The pinned official model repository identifies the released UniRig Skeleton & Skinning Prediction component as MIT and says it was trained on `Seed3D/Articulation-XL2.0`. Other models/datasets discussed in the paper may be released separately, so this clearance applies only to the exact released component and revision being benchmarked.

### Required benchmark

Use a frozen set of representative game meshes and measure:
- skeleton hierarchy correctness;
- orientation/transforms;
- skin-weight quality under a standard motion set;
- deformation artifacts;
- humanoid vs non-humanoid coverage;
- required topology cleanup;
- export/import through GLB/FBX as appropriate;
- import in at least two target runtimes;
- GPU/runtime requirements;
- failure/retry/manual cleanup time.

Every model file and input mesh gets its own asset/provenance record even where the model repository is MIT. Before execution, exact downloaded model files are hashed rather than relying on repository revision alone.

### Animation-provider separation

Rigging and animation are separate provider capabilities. A good automatic skeleton does not prove animation quality, retargeting compatibility or game-runtime performance. The pipeline should preserve a canonical rig/animation contract so animation sources can be replaced independently.

---

# 3. Sound effects and music

## Meta AudioCraft / MusicGen / AudioGen

Repository: https://github.com/facebookresearch/audiocraft  
Pinned code revision: `896ec7c47f5e5d1e5aa1e4b260c4405328bf009d`  
Code licence: MIT  
Official MusicGen/AudioGen model weights: CC-BY-NC 4.0  
Evidence: **SOURCE-VERIFIED**  
Disposition: **REFERENCE / REJECT AS DEFAULT COMMERCIAL MODEL SET**

This is a critical licence-boundary example: the framework code is permissively licensed, but the released MusicGen/AudioGen weights are explicitly non-commercial.

### Standard consequence

- AudioCraft is useful as an architecture/research baseline.
- Its CC-BY-NC model weights MUST NOT enter the automatic commercial-game provider pool.
- A future model used through the AudioCraft framework gets its own exact model licence record; the framework licence does not decide model/output eligibility.

## ElevenLabs Sound Effects / Music / Speech

Current authoritative terms:
- https://elevenlabs.io/sound-effects-terms — last updated 12 February 2026 at research time.
- https://elevenlabs.io/service-specific-terms — last updated 22 June 2026 at research time.

Evidence: **VENDOR-CLAIM / TERMS-VERIFIED, not execution evidence**  
Disposition: **BENCHMARK commercial audio provider via adapter**

Important current term detail: the Sound Effects terms allow third-party sublicensing of SFX outputs unless the user opts out; opting out stops new third-party use prospectively but does not undo licences/uses already granted. The service-specific terms are product-specific and mutable.

### Pipeline implication

For commercial audio APIs, provenance cannot be just `provider=ElevenLabs`. The record must identify:
- exact service (SFX, Music, Speech/TTS, etc.);
- current service-specific terms snapshot/version;
- plan/account context where relevant;
- opt-out/privacy/sharing state at generation time;
- input/source rights;
- model/voice ID;
- output hash and downstream modifications;
- commercial/redistribution status.

### Audio acceptance tests

Sound effects:
- prompt/event adherence;
- duration;
- start/end transient quality;
- loop seam/click measurement where looped;
- peak/clipping;
- loudness normalization target;
- file format/sample rate;
- family/style consistency;
- cost per accepted SFX.

Music:
- prompt/style adherence without unsafe style/IP prompting;
- loop/transition structure;
- loudness and peak control;
- stems/sections where available;
- variation consistency;
- transition suitability for dynamic game states;
- commercial rights for exact service/model.

---

# 4. Voice / TTS

## Resemble AI Chatterbox

Repository: https://github.com/resemble-ai/chatterbox  
Pinned code revision: `5de7a54aa4e5e2baadb0182dde554908b48b85c2`  
Official model repository: https://huggingface.co/ResembleAI/chatterbox  
Pinned model-repository revision: `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`  
Official model-card licence: MIT  
Evidence: **SOURCE-VERIFIED**  
Disposition: **BENCHMARK NOW as open/local TTS baseline**

The pinned official model repository marks Chatterbox MIT and contains multilingual/voice-cloning-oriented TTS artifacts. Exact artifacts remain independently pin-able. Current V3 examples include:
- `t3_mtl23ls_v3.safetensors` — LFS SHA-256 `5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953`;
- `s3gen_v3.safetensors` — LFS SHA-256 `4a46190f3dccc2230fbb3488a930bccc925862ee68f2662433dfcfe93ce6c2cb`;
- `s3gen_v3.pt` — LFS SHA-256 `f7abce4b196dae2d08d9296cbebc6521b046079577643b42a19a03499d08721e`.

An experiment records the exact subset downloaded and hashes the local bytes before inference; a model-repository head alone is not sufficient provenance.

### Voice safety/provenance gate

A technically permissive model licence does not grant rights to clone a person's voice.

Before any reference-conditioned or cloned voice generation:
- speaker/reference identity is recorded;
- lawful permission/consent status is recorded;
- source recording provenance is complete;
- intended use/audience is known;
- cloning is blocked when permission is absent/unclear;
- synthetic-voice disclosure/age/platform requirements are checked where applicable.

### Voice acceptance tests

- intelligibility/error rate on game dialogue;
- speaker/character consistency;
- pronunciation dictionary support;
- emotional/directing control;
- latency and realtime factor;
- CPU/GPU/RAM footprint for local modes;
- cross-language voice consistency;
- artefact/hallucination rate;
- deterministic/repeatable regeneration where possible;
- consent and provenance completeness;
- engine import/streaming performance.

## ElevenLabs voice

Treat ElevenLabs speech/voice as a separate commercial adapter from its SFX/music products. The exact Speech Engine or applicable service-specific terms must be captured per experiment. Do not reuse an SFX licence decision for voice cloning or TTS.

---

# 5. Provider-neutral production contracts

## 2D sprite set contract

A sprite-family provider should be evaluated against a canonical intent such as:

```text
character_identity
art_style_reference
palette
canvas_size
anchor
facings
animations[]
  name
  frame_count
  timing
  loop
output_atlas_format
engine_targets
```

Acceptance evidence should include automated alignment/palette/alpha/atlas checks plus human art approval.

## Rig/animation contract

```text
mesh_asset_id
rig_profile
required_bones_or_semantics
scale/orientation
animation_set
retarget_target
export_formats
engine_targets
```

Rigging, skinning, animation generation and retargeting should remain replaceable stages.

## Audio intent contract

```text
audio_role: sfx|music|voice
semantic_intent
style_constraints
length_or_loop_rules
loudness_target
sample_rate
channels
interactive_transition_requirements
localisation_or_voice_identity
engine_targets
```

A provider is selected only after licence/privacy/cost eligibility checks.

---

# 6. Immediate experiments

1. **Sprite-family benchmark** — fixed character/palette across PixelLab and at least one provider-neutral deterministic pipeline; measure accepted-set quality/cost and engine import.
2. **Sprite QA conformance** — implement/test alignment, palette, alpha, seam and atlas-metadata checks independently of provider.
3. **UniRig benchmark** — frozen mesh set → rig/skin → standard animations → two engine imports; record cleanup time and deformation defects.
4. **Audio licence negative test** — assert that AudioCraft MusicGen/AudioGen CC-BY-NC weights are rejected for a commercial target before generation.
5. **SFX benchmark** — commercial provider vs a commercially eligible open/local alternative once identified; same frozen cue list and loudness/loop tests.
6. **Voice benchmark** — Chatterbox vs one commercial speech provider on a consent-cleared voice/reference set; include latency, intelligibility, consistency and game import.
7. **Consent rejection test** — attempt voice cloning without a recorded permission state and assert the orchestrator refuses before model execution.

## Research gaps remaining

- production retargeting/motion-generation incumbents;
- lip-sync/facial animation;
- localisation/dubbing pipeline and pronunciation management;
- runtime audio middleware and adaptive-music solved systems;
- public benchmark datasets for sprite consistency, rigging quality and game-audio acceptance.
