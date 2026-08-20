# Open / Local Music Generation Baselines — 2026-08

Status: **source/terms research only; no ByJTT execution evidence yet**  
Project time: `Europe/London`  
Companion: `AI-GAME-2D-AUDIO-ANIMATION-SYSTEMS-2026-08.md`

## Why this exists

The music-generation landscape is moving too quickly to treat older AudioCraft/Stable Audio assumptions as permanent. This companion identifies the **current commercially plausible open/local baselines** and explicitly separates model/repository licence from output/IP risk.

---

## ACE-Step 1.5

Official repository: https://github.com/ace-step/ACE-Step-1.5  
Pinned code revision: `14c0211d5a0653b0f63e27686f4c3f151b4d8629`  
Repository licence at pinned revision: MIT  
Official model repository: https://huggingface.co/ACE-Step/Ace-Step1.5  
Pinned current model-repository revision: `19671f406d603126926c1b7e2adc169acbcade22`  
Earlier model-card revision independently inspected: `e491069bd696ec53bae96986197b24ffc2d8692c`  
Model-card licence: MIT  
Evidence: **SOURCE-VERIFIED**  
Disposition: **BENCHMARK NOW as open/local commercial-music candidate, pending exact component hash inventory**

Current official project/model material describes text-to-music plus reference/editing workflows and a multi-component model repository containing components such as `Qwen3-Embedding-0.6B`, `acestep-5Hz-lm-1.7B`, `acestep-v15-turbo`, and `vae`. The model card labels the released model family MIT, but repository-level licensing does not substitute for an inventory of every concrete component downloaded by a benchmark run.

### Important boundary

MIT code/model licensing does not guarantee that any requested/generated song is free of third-party copyright, performer, lyric, reference-audio or stylistic-similarity risk. The pipeline therefore still requires:
- prompt/reference provenance;
- reference-audio rights;
- generated-output hash;
- originality/similarity review appropriate to the release context;
- exact model-component revisions and local file hashes;
- human/legal escalation for material ambiguity.

Generated-output use as downstream model-training data is also not assumed merely from the model licence. That question is irrelevant to ordinary game use unless we actually train on outputs, at which point it becomes a separate licence/provenance decision.

### Benchmark

Use a frozen game-music brief set rather than one hero track:
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

That is **not the whole licence picture for every downloadable artifact**. The current gated Hugging Face Stable Audio 3 Small repositories also disclose components redistributed under the **Gemma Terms of Use**, including their own use restrictions. Access itself requires accepting the model gate and sharing contact information. Therefore a project cannot infer production eligibility from the Stability Community License alone.

### Why it matters

This materially changes our candidate set. We should not evaluate obsolete Stable Audio Open 1.0 as if it represented Stability's 2026 audio frontier, but we also must not convert a permissive top-level commercial tier into blanket clearance of transitive model components.

### Required pre-execution work

Before benchmarking any Stable Audio 3.0 artifact:
- choose the exact Small Music / Small SFX / Medium artifact;
- pin the exact Hugging Face repository revision and every relevant LFS/file hash;
- retain the exact Stability Community/Enterprise licence snapshot and account/registration requirements applicable to the run;
- separately capture and review Gemma Terms or any other transitive component terms disclosed by that exact artifact;
- record organization revenue/licence-tier eligibility at execution time;
- block automatic commercial use if the top-level and transitive terms cannot both be cleared;
- capture model/training-data provenance statements as vendor/model documentation, not independent proof.

### Benchmark

Run the same frozen game-music cue set as ACE-Step 1.5 and compare accepted-cue quality, controllability, local compute requirements, edit/variation workflow, licence friction and total game-ready cost. For SFX, use a separate frozen cue manifest rather than treating music results as evidence for one-shot game effects.

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
Disposition: **HISTORICAL/REFERENCE; do not use as the primary Stability benchmark**

The model card points commercial users to Stability's licence. The current licence framework may permit covered Stability models commercially for eligible users, but Stable Audio 3.0 is the more relevant 2026 benchmark. Keep 1.0 only for historical/reproducibility comparisons where useful, and apply the exact artifact/transitive-term review to any actual use.

---

# Commercial music benchmark rule

Every compared system uses the same frozen cue manifest and the same post-processing acceptance criteria. No cherry-picking the easiest song per provider.

Before any paid/cloud or gated-model run:
- human-approved spend ceiling where spend exists;
- exact model/provider/service and repository revision;
- exact downloaded component hashes;
- licence tier eligibility and transitive component terms;
- input/reference rights;
- output provenance record.

Before any shipped cue:
- technical audio QA;
- human music/art-direction approval;
- rights/licence status;
- similarity/originality review proportional to risk;
- engine import/runtime performance;
- final output hash and transformation history.

## Current disposition

1. **ACE-Step 1.5** — first open/local executable music benchmark once exact component hashes are frozen and a proof-capable GPU environment is available.
2. **Stable Audio 3.0 Small/Medium** — co-primary technical benchmark after exact artifact hashes **and all Stability/Gemma/transitive terms** are cleared for the intended use.
3. **Stable Audio 3.0 Small SFX** — serious SFX candidate, but evaluated with a distinct frozen SFX manifest and the same transitive-term gate.
4. **AudioCraft MusicGen/AudioGen** — research baseline and licence-negative test, not commercial default.
5. Continue searching for additional strong **commercially eligible open SFX/text-to-audio** systems; do not assume one model family should own both music and effects.
