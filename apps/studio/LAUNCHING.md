# Launch BYJTT Studio

The Studio launcher starts the existing local Studio server on a random loopback-only port, verifies that the server still advertises dry-run/no-secrets/no-publication safety, then opens the Studio URL in the default browser.

The repository root now exposes `START_STUDIO.cmd` and `START_STUDIO.command` as thin entrypoints. They delegate to the reviewed launchers in `apps/studio/`; they do not create a second server or execution path.

## Windows

From the repository root, double-click `START_STUDIO.cmd`.

No folder discovery, port selection, terminal command, GitHub action, provider credential, or secret is required. Keep the launcher window open while Studio is in use; closing it stops the local server.

The nested `apps/studio/launch-studio.cmd` remains available for compatibility.

## macOS

The repository contains `START_STUDIO.command`, but GitHub's text-file contents API cannot preserve the executable bit for this slice. On a normal Git checkout the intended final experience is double-click-to-open after that bit is present. Until the executable bit is committed by a native Git client, the truthful fallback is:

```sh
sh START_STUDIO.command
```

Do not represent this revision as zero-terminal launch on macOS.

## Linux

Run:

```sh
sh START_STUDIO.command
```

The launcher uses `xdg-open` when a desktop opener is available. If automatic opening fails, it leaves the verified local server running and prints the exact loopback URL rather than treating browser-launch availability as pipeline execution evidence.

## Verification mode

For diagnostics and CI, the same root entrypoint supports a bounded readiness check:

```sh
sh START_STUDIO.command --check
```

This starts the real Studio server, verifies the fail-closed capability contract, prints the verified loopback URL, and exits without opening a browser or keeping the server alive.

## Safety boundary

The launcher does not build a second Studio stack. It imports `tools/studio-server.mjs`, binds to `127.0.0.1` with an ephemeral port, checks `/api/pipeline/capabilities`, and refuses readiness unless `dryRunOnly=true`, `secretsRequired=false`, and `publicationSupported=false`.
