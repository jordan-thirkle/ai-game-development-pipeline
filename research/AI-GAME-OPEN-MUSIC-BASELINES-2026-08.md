# Open / Local Music Generation Baselines — 2026-08

Research date: **2026-08-20**  
Last verified: **2026-08-20T02:51:00+01:00** (`Europe/London`)  
Execution status: **NOT EXECUTED — source/terms research only**  
Tested version/configuration status: **no ByJTT audio has been generated or accepted under this document**  
Update/supersession status: **current music research snapshot; Stable Audio 3.0 supersedes old 1.0 as Stability's primary 2026 benchmark, subject to exact-artifact terms**  
Companion: `AI-GAME-2D-AUDIO-ANIMATION-SYSTEMS-2026-08.md`  
Evaluation protocol authority: `AI-GAME-DEV-EVALUATION-SYSTEMS-2026-08.md`

## Why this exists

The music-generation landscape is moving too quickly to treat older AudioCraft/Stable Audio assumptions as permanent. This companion identifies the **current commercially plausible open/local baselines** and explicitly separates model/repository licence from output/IP risk.

Every experiment below is bound to the universal frozen run-manifest rule in `AI-GAME-DEV-EVALUATION-SYSTEMS-2026-08.md`: immutable manifest ID/hash, exact inputs and hashes, component/model revisions, execution environment, seeds, retry/attempt policy, predeclared selection/acceptance criteria, spend ceilings, credential scope and complete provenance. A changed manifest means a new benchmark run; results are not pooled across manifest hashes.

---

## ACE-Step 1.5

Official repository: https://github.com/ace-step/ACE-Step-1.5  
Pinned code revision: `14c0211d5a0653b0f63e27686f4c3f151b4d8629`  
Repository licence at pinned revision: MIT  
Official model repository: https://huggingface.co/ACE-Step/Ace-Step1.5  
Pinned current model-repository revision: `19671f406d603126926c1b7e2adc169acbcade22`  
Original component upload revision: `571cee8` (abbreviated Hugging Face commit displayed by the official repository; full repository revision must be resolved and stored by the run manifest before download)  
Model-repository metadata licence: MIT  
Evidence: **SOURCE-VERIFIED for repository/model metadata and file hashes; commercial-output/training-data statements are not independently established**  
Disposition: **TECHNICAL BENCHMARK CANDIDATE; production promotion blocked pending exact component ledger + output-rights decision**

### Component ledger required for the reference bundle

The official model repository is a composite, not one opaque weight. A proposed baseline currently includes:

1. **Qwen3 embedding component** — bundled path `Qwen3-Embedding-0.6B/`
   - bundled upload revision: `571cee8` (resolve full hash in manifest)
   - bundled `model.safetensors` SHA-256: `0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd`
   - upstream family: `Qwen/Qwen3-Embedding-0.6B`
   - upstream model metadata licence: Apache-2.0
   - upstream immutable revision/hash still required in the execution manifest; a bundled copy does not replace upstream provenance.
2. **ACE-Step 5 Hz language model** — proposed path `acestep-5Hz-lm-1.7B/`
   - bundled upload revision: `571cee8` (resolve full hash in manifest)
   - `model.safetensors` SHA-256: `f161689da73e5ecefa28ff780d51c2d92a00f056d021d7933c779ed5c6cd7db8`
   - configuration identifies Qwen3 architecture; ACE-Step documentation describes the 1.7B LM as pretrained from Qwen3-1.7B
   - upstream `Qwen/Qwen3-1.7B` metadata licence: Apache-2.0
   - the ACE-Step fine-tuned artifact is covered by the ACE-Step model-repository metadata at the frozen revision, but upstream provenance/notice obligations remain recorded separately.
3. **ACE-Step DiT / generation model** — proposed path `acestep-v15-turbo/`
   - bundled upload revision: `571cee8` (resolve full hash in manifest)
   - `model.safetensors` SHA-256: `3f6e0797fad420a39bd33979eb6e840e30989e34a3794e843d23b60ec6e422d7`
   - top-level model repository metadata: MIT
   - remote-code files `configuration_acestep_v15.py` and `modeling_acestep_v15_turbo.py` carry Apache-2.0 source headers and are executable code, not inert weights.
4. **VAE** — path `vae/`
   - bundled upload revision: `571cee8` (resolve full hash in manifest)
   - `diffusion_pytorch_model.safetensors` SHA-256: `da17edb604c40deaf09e9b24974e590d1ca83a374070e5d0884cfa4bed9a99b0`
   - top-level model repository metadata: MIT; exact upstream/derivation provenance must be recorded if the model card or files identify one.
5. **Custom/remote Python code**
   - `trust_remote_code=True` is documented by the model repository and means the benchmark executes repository-supplied Python.
   - every executed remote-code path is pinned to the same immutable model-repository revision, reviewed as code, and recorded in the run manifest before execution.
   - per-file licence headers take precedence over any assumption that one top-level metadata value describes every copied source file.

If any component actually selected by the benchmark differs from this proposed bundle, it gets a new component record and the run manifest changes.

### Output-rights and training-data boundary

The project repository is MIT and the project/model materials position ACE-Step for creative/commercial use, but this is not treated as independent legal proof about every generated artifact. A May 2026 upstream issue (`ace-step/ACE-Step-1.5#1182`) explicitly asked whether generated outputs may be used as downstream training data; it was closed as not planned without an authoritative project answer. A later rights clarification discussion also remained unanswered at research time. Those community threads are **non-authoritative context**, not licence terms.

Therefore:
- output-as-training-data status is **UNKNOWN** until an authoritative versioned source says otherwise;
- ordinary technical benchmarking does not require us to answer that unrelated training question;
- a generated cue cannot become `production_candidate` solely because the repository/model metadata says MIT;
- prompt/reference rights, originality/similarity review and the exact release-context legal decision remain separate gates.

### Benchmark

Use a frozen game-music brief set from one immutable manifest rather than one hero track:
- main-menu theme;
- exploration loop;
- combat loop;
- low-health/high-tension variant;
- victory sting;
- one adaptive transition pair.

Measure:
- prompt/structure adherence;
- musical coherence;
- loop/transition edit effort;
- long-range repetition defects;
- BPM/key stability where requested;
- vocal/lyric avoidance when instrumental is required;
- generation/retry time;
- VRAM/RAM/disk footprint;
- deterministic regeneration controls;
- stem/edit capabilities;
- cost per accepted game-ready cue;
- provenance/commercial-readiness completeness.

All failed/rejected attempts count under the manifest's fixed retry policy; cherry-picking unrecorded generations invalidates the run.

---

## Stable Audio 3.0

Official announcement: https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models  
Current licence authority: https://stability.ai/license  
Official model collection: https://huggingface.co/collections/stabilityai/stable-audio-3  
Current artifacts surfaced by that collection:
- https://huggingface.co/stabilityai/stable-audio-3-small-music
- https://huggingface.co/stabilityai/stable-audio-3-small-sfx
- https://huggingface.co/stabilityai/stable-audio-3-medium

Evidence: **SOURCE-VERIFIED vendor/model-family terms; exact downloadable file revisions/hashes still required before execution**  
Disposition: **BENCHMARK NOW only after artifact-level and transitive licence clearance**

Stability AI's current official material describes Stable Audio 3.0 Small/Medium as open-weight models and states the family was trained on fully licensed data, with longer music-generation capabilities than the older 1.0 generation. The current Stability AI Community License page states free commercial use of covered Core Models for eligible creators/organizations under its current revenue threshold, with Enterprise licensing required above that threshold; the 3.0 announcement states creators may commercialize outputs under the applicable licence.

Those training-data/output statements remain **vendor/model documentation**, not independent audit evidence.

That is **not the whole licence picture for every downloadable artifact**. The current gated Hugging Face Stable Audio 3 Small repositories also disclose components redistributed under the **Gemma Terms of Use**, including their own use restrictions. Access itself requires accepting the model gate and sharing requested account/contact data. Therefore a project cannot infer production eligibility from the Stability Community License alone.

### Required pre-execution work

Before benchmarking any Stable Audio 3.0 artifact, the immutable run manifest must:
- choose the exact Small Music / Small SFX / Medium artifact;
- pin exact Hugging Face repository revision and every relevant LFS/file hash;
- retain a durable Stability Community/Enterprise licence snapshot/reference + SHA-256 and retrieval timestamp;
- separately retain and review Gemma Terms or any other transitive component terms disclosed by that exact artifact;
- record gated-access fields/data disclosed and their handling/retention policy;
- record organization revenue/licence-tier eligibility at execution time;
- block automatic commercial use if top-level and transitive terms cannot both be cleared;
- capture model/training-data provenance statements as vendor/model documentation, not independent proof.

### Benchmark

Run the same frozen game-music cue manifest as ACE-Step 1.5 and compare accepted-cue quality, controllability, local compute requirements, edit/variation workflow, licence friction and total game-ready cost. For SFX, use a separate frozen cue manifest rather than treating music results as evidence for one-shot game effects.

---

## AudioCraft / MusicGen / AudioGen

Repository: https://github.com/facebookresearch/audiocraft  
Pinned code revision: `896ec7c47f5e5d1e5aa1e4b260c4405328bf009d`  
Code licence: MIT  
Released MusicGen/AudioGen weights: CC-BY-NC 4.0  
Disposition: **REFERENCE / NEGATIVE COMMERCIAL-ELIGIBILITY TEST**

AudioCraft remains technically useful research, but its commonly released MusicGen/AudioGen weights are explicitly non-commercial. The provider selector must therefore reject those exact weights when `intended_use=commercial` rather than relying on the framework's MIT code licence.

---

## Stable Audio Open 1.0

Official model card: https://huggingface.co/stabilityai/stable-audio-open-1.0  
Evidence: **SOURCE-VERIFIED model metadata only**  
Disposition: **HISTORICAL/REFERENCE; do not use as the primary Stability benchmark**

The current model card uses `stable-audio-community` licensing metadata and a gated-access prompt. Access currently asks for:
- name;
- email;
- country;
- organization or affiliation;
- intended-use category;
- acknowledgement of the licence agreement/privacy policy;
- optional marketing-email preference.

Any historical/reproducibility run records the exact gate fields submitted, the account/identity responsible, purpose, where that contact information is transmitted/stored, the applicable Stability privacy-policy/terms snapshot, retention/deletion handling where controllable, and the exact model artifact revision/hashes. Credentials/contact details themselves are not committed to the public repository; the provenance record stores redacted identifiers and handling evidence.

The model card points commercial users to Stability's licensing framework, but Stable Audio 3.0 is the more relevant 2026 benchmark. Keep 1.0 only for historical/reproducibility comparisons where useful, and apply exact artifact/transitive-term review to any actual use.

---

# Commercial music benchmark rule

Every compared system uses the same frozen cue manifest and the same post-processing acceptance criteria. No cherry-picking the easiest song per provider.

Before any paid/cloud or gated-model run, the immutable manifest records:
- manifest ID + content hash;
- exact cue IDs/input hashes and selection rules;
- exact model/provider/service and component revisions/hashes;
- execution environment and determinism controls;
- retry/attempt policy;
- hard spend/time/compute ceilings;
- licence-tier eligibility and transitive component terms;
- credential/data-disclosure scope;
- input/reference rights;
- output provenance record IDs.

Before any shipped cue:
- technical audio QA;
- human music/art-direction approval;
- rights/licence status;
- similarity/originality review proportional to risk;
- engine import/runtime performance;
- final output hash and transformation history.

## Current disposition

1. **ACE-Step 1.5** — technical open/local benchmark candidate after full component records are resolved to immutable hashes; production promotion remains separately gated on output-rights/originality review.
2. **Stable Audio 3.0 Small/Medium** — co-primary technical benchmark after exact artifact hashes **and all Stability/Gemma/transitive terms** are cleared for the intended use.
3. **Stable Audio 3.0 Small SFX** — serious SFX candidate, but evaluated with a distinct frozen SFX manifest and the same transitive-term gate.
4. **AudioCraft MusicGen/AudioGen** — research baseline and licence-negative test, not commercial default.
5. Continue searching for additional strong **commercially eligible open SFX/text-to-audio** systems; do not assume one model family should own both music and effects.
