# Launch BYJTT Studio

The Studio launcher starts the existing local Studio server on a random loopback-only port, verifies that the server still advertises dry-run/no-secrets/no-publication safety, then opens the Studio URL in the default browser.

## Windows

Double-click `launch-studio.cmd`.

No port selection, terminal command, GitHub action, provider credential, or secret is required. Keep the window open while Studio is in use; closing it stops the local server.

## macOS

The repository contains `launch-studio.command`, but GitHub's text-file contents API cannot preserve the executable bit for this initial slice. On a normal Git checkout the intended final experience is double-click-to-open after that bit is present. Until the executable bit is committed by a native Git client, the truthful fallback is:

```sh
sh apps/studio/launch-studio.command
```

Do not represent this revision as zero-terminal launch on macOS.

## Linux

Run:

```sh
sh apps/studio/launch-studio.command
```

The launcher uses `xdg-open` when a desktop opener is available. If automatic opening fails, it leaves the verified local server running and prints the exact loopback URL rather than treating browser-launch availability as pipeline execution evidence.

## Safety boundary

The launcher does not build a second Studio stack. It imports `tools/studio-server.mjs`, binds to `127.0.0.1` with an ephemeral port, checks `/api/pipeline/capabilities`, and refuses readiness unless `dryRunOnly=true`, `secretsRequired=false`, and `publicationSupported=false`.
