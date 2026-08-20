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
Pinned model-repository revision inspected: `e491069bd696ec53bae96986197b24ffc2d8692c`  
Model-card licence: MIT  
Evidence: **SOURCE-VERIFIED**  
Disposition: **BENCHMARK NOW as open/local commercial-music candidate**

Current official project/model material describes text-to-music plus reference/editing workflows and a 10+ GB multi-component model repository. The model card explicitly labels the released model family MIT.

### Important boundary

MIT code/model licensing does not guarantee that any requested/generated song is free of third-party copyright, performer, lyric, reference-audio or stylistic-similarity risk. The pipeline therefore still requires:
- prompt/reference provenance;
- reference-audio rights;
- generated-output hash;
- originality/similarity review appropriate to the release context;
- exact model-component revisions;
- human/legal escalation for material ambiguity.

Generated-output use as downstream model-training data is also not assumed merely from the model licence; upstream community discussion shows this has required clarification. That question is irrelevant to ordinary game use unless we actually train on outputs, at which point it becomes a separate licence/provenance decision.

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
Evidence: **SOURCE-VERIFIED vendor/model-family terms; exact downloadable artifact revision not yet pinned**  
Disposition: **BENCHMARK NOW after exact model artifact is pinned**

Stability AI's current official material describes Stable Audio 3.0 Small/Medium as open-weight models trained on fully licensed data, with longer music-generation capabilities than the older 1.0 generation. The current Stability AI Community License page states free commercial use of covered Core Models for creators/organizations under USD $1M annual revenue, with Enterprise licensing required above that threshold; the 3.0 announcement states creators own and may commercialize outputs under the applicable licence.

### Why it matters

This materially changes our candidate set. We should not evaluate obsolete Stable Audio Open 1.0 as if it represented Stability's 2026 audio frontier.

### Required pre-execution work

Before benchmarking:
- identify the exact Small/Medium Hugging Face artifact URL;
- pin model/repository revision and all relevant component hashes;
- retain the exact Community License snapshot/registration requirement applicable to the run;
- record organization revenue/licence tier eligibility at execution time;
- capture model/training-data provenance statements without converting vendor statements into independent proof.

### Benchmark

Run the same frozen game-music cue set as ACE-Step 1.5 and compare accepted-cue quality, controllability, local compute requirements, edit/variation workflow, licence friction and total game-ready cost.

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

The model card points commercial users to Stability's licence. The current Community License can permit covered Stability models commercially below the revenue threshold, but Stable Audio 3.0 is the more relevant 2026 benchmark. Keep 1.0 only for historical/reproducibility comparisons where useful.

---

# Commercial music benchmark rule

Every compared system uses the same frozen cue manifest and the same post-processing acceptance criteria. No cherry-picking the easiest song per provider.

Before any paid/cloud run:
- human-approved spend ceiling;
- exact model/provider/service version;
- licence tier eligibility;
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

1. **ACE-Step 1.5** — first open/local executable music benchmark once proof-capable GPU environment is available.
2. **Stable Audio 3.0 Small/Medium** — co-primary benchmark after exact downloadable artifact/revision is pinned.
3. **AudioCraft MusicGen/AudioGen** — research baseline and licence-negative test, not commercial default.
4. Continue searching for a strong **open SFX/text-to-audio** model whose current model weights and outputs are commercially eligible; do not assume music models are optimal for one-shot game SFX.
