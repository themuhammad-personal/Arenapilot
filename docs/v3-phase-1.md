# V3 Core / Phase 1: remove the on-device Linux runtime

Base: `9626dcf3b18abd4315b72ac4edd8c1a20fa93577` (`main`). This checkpoint is not a V3 release.

## Boundaries found in the app

- The former service, Studio activity, bridge methods, rootfs metadata and PRoot ABI payload formed one on-device execution path. The server was added implicitly during MCP discovery. Old instructions described the contents of a device workspace to the model.
- `assets/bds/sandbox.html` and `sandbox.js` have a different purpose: the isolated web document generator used for DOCX, XLSX and PPTX. They stay. Do not remove WebView isolation or its renderer-process diagnostics because they contain the same word.
- The runtime, ABI build/packaging and Studio-only permissions, resources, agent prompt/UI and harness simulation were removed. Only configured, enabled HTTP(S) MCP servers can be selected by chat tags. Tool results are scoped to the originating Direct conversation and modality. Old result cards remain readable. Stop suppresses subsequent dispatch and delivery; it does not claim to cancel work on a remote server.
- The app ID, keystore, storage implementation and preference keys for user content stay in place. There is no new store, repo connector, mirror, reset or uninstall step. The existing auto-continue preference remains accessible without Studio. The update deliberately does not delete files left by an earlier version.
- CI checks the **actual APK** for retired payloads/components and required document assets. A missing signing key or a release certificate that differs from v2.4.0 fails the release build. Use `[verify-only]` in a checkpoint commit to run CI on `main` without replacing a public release. A successful build artifact alone is not acceptance.

## Local evidence

| Check | Result |
|---|---|
| Node 22.23.5: engine, models and release hygiene | 489 passed; 0 failed/skipped |
| Chromium (real bundles on offline fixtures) | Arena suite passed (9 checkpoints); legacy suite: 7 passed, 2 explicitly skipped (settings pages, sheet drag) |
| Android JVM unit tests, JDK 17 / SDK 34 | 286 passed in 27 suites; 0 errors/failures/skips |
| Gradle | `assembleDebug`, `assembleDebugAndroidTest`, `assembleRelease` all succeeded |
| Python packaging/launch regressions | 16 passed (includes the underlying packaging tests also called from Node) |
| Compiled Debug and Release APK manifests/assets | Existing package, launcher/art, document renderer present; retired native runtime absent |
| Release-variant signature | `apksigner verify` passed. Public signer SHA-256 `ffdd6e6acd136fc2a955f6aa7be0df3c851c671caaffb8cbc53c3397e698383c`, equal to the published v2.4.0 APK (versionCode 1352). Local build ID 0 produces versionCode 1000: **not an update candidate**. CI supplies its monotonic run number. |

**CI evidence:** [Run #354](https://github.com/themuhammad-personal/Arenapilot/actions/runs/44327504709) passed the build, signature and real API 34 emulator gates at `64d7a48`: both launches were alive and all 7 connected tests actually ran. Neither publishing job ran. The subsequent Stop/resume regression fixes have their own run; #354 is not their evidence.

**Stop and navigation:** A batch now captures the Stop generation when queued. Resuming allows new work without reviving the old result. Per-thread duplicate detection no longer suppresses a legitimate call in the next Direct conversation. Retries check the composer, draft and originating task again before clicking Send. A changed or unverified route drops pending delivery rather than guessing the user's destination.

**Upgrade gate:** On a `main` checkpoint carrying *both* `[verify-only]` and `[upgrade-check]`, an independent fresh API 34 emulator installs the digest-pinned, published v2.4.0 APK, dismisses its first-launch notice, installs the actual signed CI artifact with `adb install -r`, and checks the version increase, unchanged UID and first-install time, retained notice preference, and the live WebView. It fails rather than trying a downgrade, wipe or uninstall. Read its own Actions job conclusion for the actual result. This is not a claim about every setting, an authenticated session, or all OEM devices. No live chat was sent by the fixtures. Phases 2–8 are not part of this checkpoint.

## Sources and reproducibility

- [Arena: Fullstack Code Arena](https://arena.ai/blog/fullstack-code-arena) describes the hosted sandbox and preview. It is not a native API contract; this removal does not implement a private endpoint or a replacement local sandbox.
- [Android: Sign your app](https://developer.android.com/studio/publish/app-signing) and [the published v2.4.0 release](https://github.com/themuhammad-personal/Arenapilot/releases/tag/v2.4.0) informed the signer comparison.
- [MCP: Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) distinguishes server discovery from invocation; removing the implicit server must not remove user-configured `tools/list` and `tools/call`.
- `npm ci && npm test`, `npm run test:harness:arena`, `npm run test:harness`, `python3 -m unittest android/ci/test_startup.py android/ci/test_apk_check.py android/ci/test_upgrade.py`. For Android: `npm run android:stage-engine`, then from `android/`, `./gradlew testDebugUnitTest assembleDebug assembleDebugAndroidTest assembleRelease`; `connectedDebugAndroidTest` requires a device.
