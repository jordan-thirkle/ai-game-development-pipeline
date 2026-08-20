# AI Game Multiplayer, Backend and Server Systems — 2026-08

Research date: **2026-08-20**  
Last verified: **2026-08-20T03:41:37+01:00** (`Europe/London`)  
Execution status: **NOT EXECUTED — source/vendor research only**  
Tested version/configuration status: **no ByJTT multiplayer benchmark result is claimed here**  
Update/supersession status: **current living research snapshot; supersedes generic assumptions that one multiplayer vendor should own backend, netcode, matchmaking and hosting**  
Registry authority: `../registry/ai-game-dev-registry.v1.json`  
Evaluation authority: `AI-GAME-DEV-EVALUATION-SYSTEMS-2026-08.md`

## Decision

Do **not** select one “multiplayer stack” as an indivisible product. Separate four replaceable roles:

1. **meta-game/backend** — identity, storage, social, leaderboards, progression, parties and matchmaking;
2. **authoritative session runtime** — validates gameplay input and owns match state;
3. **engine netcode/prediction** — replication, prediction, rollback/reconciliation and physics integration;
4. **dedicated-server orchestration/hosting** — build deployment, allocation, regions, autoscaling, health, rollback, observability and DDoS posture.

Canonical game rules and persistent domain state must remain portable across these boundaries. A provider-specific SDK is an adapter, not the canonical game model.

## Default economic rule

Multiplayer complexity is earned, not assumed. A game should remain local/offline-first where practical until its product loop proves that multiplayer materially improves the game. When multiplayer is required:

- use the lowest-operational-burden architecture that meets cheat resistance, latency and scale requirements;
- prefer managed infrastructure while the player base is small and uncertain;
- preserve a path to self-host/BYOC only when measured scale economics justify the extra operations burden;
- never build a custom fleet manager, matchmaking service or generic realtime transport before evaluating the mature systems below.

---

# 1. Meta-game/backend and matchmaking

## Nakama

Official repository: https://github.com/heroiclabs/nakama  
Pinned stable release commit: `d4d92f93f78bbbe62c7fc50a3f85c772ec121a09`  
Release: **v3.40.0 — 2026-07-13**  
Repository licence: **Apache-2.0**  
Official docs: https://heroiclabs.com/docs/nakama/  
Evidence: **SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT BACKEND BENCHMARK + AUTHORITATIVE-SERVER BENCHMARK**

Nakama is the strongest current open-source baseline for the **meta/backend layer** because the same system covers account/auth flows, storage, social/realtime features, matchmaking and both relayed and server-authoritative multiplayer. Its authoritative match runtime owns central state, validates messages and runs a configurable fixed tick. Its documentation explicitly distinguishes:

- relayed/client-authoritative matches, where payloads are forwarded without cheat validation;
- server-authoritative matches, where custom server runtime logic validates and broadcasts state;
- session-based multiplayer, where a separate headless Unity/Unreal-style game server runs the complex simulation and Nakama remains the central matchmaking/meta-game layer.

This separation is useful to ByJTT: Nakama can be the backend without forcing every game simulation to run inside Nakama.

### Important limits

- Custom authoritative gameplay still requires server runtime logic; there is no generic automatic game simulation.
- For physics-heavy/high-frequency games, benchmark a headless dedicated game server rather than assuming the Nakama match loop is the correct physics runtime.
- Open-source single-node capability, clustered/enterprise capability and Heroic Cloud commercial services are different operational/licensing records.

### Required benchmark

Against identical game/domain contracts:

- identity/session lifecycle;
- profile + durable storage;
- leaderboard/progression mutation with server authority;
- party/lobby and matchmaking;
- reconnect/resume;
- 4–16 player authoritative room at several tick rates;
- cheat-invalid input rejection;
- deployment/recovery burden;
- CPU/RAM/network use per active match;
- client SDK coverage for Unity, web and other target runtimes;
- self-hosted monthly baseline cost versus managed alternatives.

---

## PlayFab Multiplayer

Current Matchmaking docs: https://learn.microsoft.com/en-us/gaming/playfab/multiplayer/matchmaking/  
Current REST surface observed at research time: Matchmaking API version `260703`  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **ENTERPRISE/MICROSOFT ECOSYSTEM BENCHMARK, NOT DEFAULT**

PlayFab provides rule-based matchmaking with queues, tickets, team/skill/region constraints and integration with Multiplayer Servers. It is a serious vendor benchmark when Xbox/Microsoft ecosystem integration or managed enterprise backend services matter.

It is not the default portable core because the API/data/service model is vendor-governed. Any benchmark records exact API/SDK versions, title configuration, pricing region and export/migration path.

---

# 2. Authoritative session servers

## Colyseus

Official repository: https://github.com/colyseus/colyseus  
Pinned source snapshot: `1dcf9e5b3dce8485e4a1a809dd98af9b328da149`  
Repository licence at pinned snapshot: **MIT**  
Current 0.17 release family observed at research time includes `@colyseus/core` **0.17.45** and `@colyseus/uwebsockets-transport` **0.17.21**.  
Official docs: https://docs.colyseus.io/  
Evidence: **SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT LIGHTWEIGHT AUTHORITATIVE-ROOM BENCHMARK**

Colyseus is an open-source Node.js authoritative server framework built around Rooms, matchmaking and schema/state synchronization. Official docs describe horizontal and vertical scaling across processes, with Redis required for multi-process/distributed scaling outside managed Colyseus Cloud.

Its strongest ByJTT role is a low-friction, engine-neutral authoritative session server for browser/mobile/casual-to-mid-frequency games where a TypeScript server domain model is desirable.

### Security/currentness note

The July 2026 `@colyseus/uwebsockets-transport` 0.17.21 release fixed a remotely triggerable process crash involving incomplete/slow HTTP request bodies and added a configurable body-read timeout. Production evaluation therefore pins the transport as well as core/framework packages rather than saying only “Colyseus 0.17”.

### Required benchmark

- room lifecycle and matchmaking;
- authoritative input validation;
- deterministic/state-sync behavior under 0/50/100/200 ms latency;
- 0/1/5% packet loss where transport/testing permits;
- reconnect/rejoin;
- bandwidth per client;
- room CPU/RAM at 4/8/16/32 players;
- Redis-backed multi-process scaling;
- graceful deploy/version transition;
- Unity, Godot and browser client interoperability;
- operational comparison with equivalent Nakama match logic.

---

# 3. Engine netcode and prediction

## Photon Fusion 2

Official docs: https://doc.photonengine.com/fusion/current/  
Research-time sample/runtime baseline: **Fusion 2.1.1 (2026-07-02)**  
Research-time advanced physics addon baseline: **2.1.2 (2026-07-22)**  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **UNITY HIGH-FIDELITY NETCODE BENCHMARK; ADAPTER, NOT CANONICAL BACKEND**

Fusion supports materially different topologies:

- **Server Mode** — a dedicated server has state authority;
- **Host Mode** — a player-hosted client/server topology with server authority;
- **Shared Mode** — cloud-room/shared authority, simpler and particularly relevant to mobile/web but with a different trust/cheat profile.

Host/Server mode support prediction, reconciliation/rollback-style resimulation. Fusion's 2.1 physics addon can provide predicted rigidbody interactions but explicitly warns that physics resimulation is CPU expensive.

Dedicated Server mode still requires a separate game-server host/orchestrator. Photon Cloud participates in the topology but does not remove the dedicated headless-hosting problem. Current Photon documentation explicitly recommends choosing topology early because the programming model changes materially.

### Pipeline consequence

Fusion is never allowed to become the only representation of gameplay rules. The benchmark adapter maps portable gameplay intent/state into Fusion-specific NetworkObjects/behaviours. This preserves the option to benchmark a different engine or transport later.

### Required benchmark

Use the same small action arena as open-source alternatives and measure:

- input responsiveness under latency/loss;
- correction magnitude/frequency;
- predicted physics quality and CPU cost;
- bandwidth;
- host migration/failure behavior where applicable;
- mobile/WebGL constraints;
- dedicated-server build size/startup time;
- Photon CCU/bandwidth cost plus third-party dedicated-host cost;
- implementation complexity versus engine-native/open alternatives.

---

# 4. Dedicated-server orchestration and hosting

## Agones

Official repository: https://github.com/agones-dev/agones  
Pinned stable release commit: `9005c6c511699eaa5799b4295cae0f91c686b1a0`  
Release: **v1.59.0 — 2026-07-01**  
Licence: **Apache-2.0**  
Official docs: https://agones.dev/  
Evidence: **SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **OPEN ORCHESTRATION BENCHMARK / SCALE-AND-SOVEREIGNTY PATH, NOT INDIE DEFAULT**

Agones extends Kubernetes with game-server-specific lifecycle primitives such as GameServers and Fleets, health/readiness/allocation behavior, autoscaling integrations and game-server SDKs.

It solves a real problem but introduces a Kubernetes operations surface. For ByJTT it is the **ownership/portability reference**, not the default first deployment for a small game. The relevant question is whether scale/cost/sovereignty gains justify running the underlying cluster and observability/security stack.

### Required benchmark

- container integration effort;
- server Ready/Allocated/Shutdown lifecycle correctness;
- allocation latency and warm-capacity requirement;
- fleet autoscaling behavior;
- rolling update without killing active sessions;
- multi-region topology;
- node/cluster failure recovery;
- observability burden;
- Kubernetes and cloud costs at low, medium and burst traffic;
- operator hours per month.

---

## GameFabric by Nitrado

Official docs: https://docs.gamefabric.com/  
Official product: https://gamefabric.com/  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **PRIMARY MANAGED DEDICATED-SERVER ORCHESTRATION BENCHMARK**

GameFabric currently presents an Agones-based orchestration platform across bare metal and cloud/BYOC, with API and Terraform control. Its documentation exposes allocation, fleet/lifecycle concepts and Agones integration, making it especially useful as a managed comparison against raw Agones.

It is also the migration partner named by Hathora when Hathora exited gaming infrastructure in 2026, which makes it materially more current than copying old Hathora recommendations.

Production adoption still requires a commercial quote/terms/SLA/security review and a measured comparison against Edgegap or direct Agones/BYOC.

---

## Edgegap

Official docs: https://docs.edgegap.com/  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **MANAGED EDGE-ORCHESTRATION BENCHMARK**

Current docs describe container game-server deployment/orchestration, matchmaking/server-browser integration and a large multi-provider location footprint with pay-per-use positioning. It is a serious low-operations benchmark for session-based games.

Do not accept location-count, latency or cost superiority as measured ByJTT evidence until an identical server image and player-location manifest is executed across managed candidates.

---

# 5. Explicitly superseded / do-not-start-new

## Hathora Cloud — reject for new ByJTT game hosting

Official March 4, 2026 announcement: https://blog.hathora.dev/hathora-is-joining-fireworks-ai/  
Evidence: **SOURCE-VERIFIED vendor announcement**  
Disposition: **REJECT FOR NEW PROJECTS / HISTORICAL MIGRATION REFERENCE**

Hathora announced its acquisition by Fireworks AI and stated that gaming-customer support would continue only through **2026-05-05**, with Nitrado GameFabric as the migration path. The current date is after that support date. Historic Hathora performance/architecture material may still be useful research, but future agents must not recommend Hathora Cloud as an active new-game default.

## Unity Multiplay direct Game Server Hosting — reject for new hosting allocations

Current Unity docs state direct Multiplay Hosting support concluded **2026-03-31**. Unity Matchmaker continues and now documents external hosting-provider integration through Cloud Code modules.  
Current Matchmaker docs: https://docs.unity.com/en-us/matchmaker  
Migration docs: https://docs.unity.com/en-us/matchmaker/multiplay-hosting-migration  
Evidence: **SOURCE-VERIFIED vendor docs**  
Disposition: **DIRECT HOSTING SUPERSEDED; KEEP MATCHMAKER AS SEPARATE BENCHMARK CANDIDATE**

Do not conflate Unity Matchmaker with the deprecated direct Multiplay Hosting service.

---

# 6. Provider-neutral multiplayer contract

A production game should depend on a portable contract shaped roughly as:

```text
PlayerIdentity
PartyIntent
MatchmakingIntent
  mode
  party
  skill/rank
  region_latency[]
  build_version
  constraints
MatchAssignment
  session_id
  region
  connection_descriptor
  server_build
AuthoritativeInput
  player_id
  sequence
  client_tick
  command
AuthoritativeSnapshot
  server_tick
  acknowledged_input
  state_delta_or_snapshot
PersistentMutation
  subject
  operation
  idempotency_key
  authoritative_reason
```

Provider adapters translate these concepts to Nakama tickets/matches, Colyseus rooms, Photon sessions, PlayFab queues, GameFabric/Edgegap allocation APIs, etc. Provider-specific objects must not leak into saved canonical game rules or player progression models.

---

# 7. Benchmark suite

## Benchmark A — portable meta/backend

One identical small game profile exercises:

1. anonymous/device sign-in and account linking;
2. player profile read/write;
3. idempotent reward grant;
4. leaderboard write/read;
5. party/lobby;
6. region/skill matchmaking;
7. reconnect/session expiry;
8. administrative ban/revoke path;
9. data export/deletion feasibility;
10. migration/export path.

Measure agent build time, human intervention, API surface, custom code, latency, cost, security posture and provider replacement cost.

## Benchmark B — realtime authoritative arena

One tiny 4–16 player action arena with a frozen deterministic ruleset:

- move;
- one hitscan/projectile action;
- one physics interaction;
- health/death/respawn;
- pickup;
- match timer + score;
- reconnect.

Run fixed scenarios under normal network, 50/100/200 ms RTT and controlled loss/jitter. Measure server tick stability, correction behavior, bandwidth, CPU/RAM, cheat-invalid input rejection, reconnect correctness, client feel and implementation complexity.

## Benchmark C — dedicated server allocation

Use the **same containerized headless server image** across eligible providers. Freeze regions, hardware class, warm-capacity policy, session duration and load trace. Measure:

- build-to-deploy time;
- cold and warm allocation latency;
- geographic latency;
- scale-up/down lag;
- failed allocation rate;
- rolling deployment/rollback;
- active-session preservation;
- logs/metrics/traces;
- DDoS/network controls;
- cost per server-hour and per completed player-session;
- operator effort;
- migration/BYOC portability.

A provider cannot win from marketing location counts or list pricing alone.

---

# 8. Current recommendation hierarchy

1. **Nakama** — incumbent open backend/meta-game benchmark and one authoritative-room candidate.
2. **Colyseus** — incumbent lightweight TypeScript authoritative-room benchmark, especially valuable for web/cross-engine workflows.
3. **Photon Fusion 2** — Unity-specific high-fidelity prediction/physics benchmark; use only behind a provider-neutral game contract.
4. **Managed server hosting first when dedicated servers are genuinely required:** benchmark **GameFabric** and **Edgegap** with the same container/load trace.
5. **Agones** — ownership/scale benchmark and future BYOC/self-managed path, adopted only when its measured economics justify Kubernetes operations.
6. **PlayFab** — managed Microsoft/Xbox ecosystem benchmark, not the portable default.
7. **Unity Matchmaker** may remain a matchmaking candidate; **Unity Multiplay direct hosting is not a new-project option**.
8. **Hathora Cloud is not a current new-project option**.

This is a research ordering, not a production winner declaration. No system above becomes `preferred` or `EXECUTED` until ByJTT runs the relevant frozen benchmark.