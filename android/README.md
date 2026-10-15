# ArenaPilot for Android

The native shell of ArenaPilot (`com.arenadeck.app`). It opens `https://arena.ai`
(Direct Chat) in a WebView, injects the engine on every page load and exposes a small
native bridge: storage, file pickers, downloads, haptics and updates. The official
arena.ai interface itself is the app's face — phase N0 of the roadmap styles it
Android-native in place (a separate Compose shell over the page was built, then
removed on the owner's 2026-10-15 decision).
The overall design is described in [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Build

From the repository root:

```bash
npm ci
npm run android:stage-engine     # copies bds-assets/bds into app/src/main/assets/bds
cd android
./gradlew testDebugUnitTest      # JVM unit tests
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease        # → signed with app/superdeepseek-release.jks
```

`app/src/main/assets/` is generated (gitignored): edit the engine in
`app/src/main/bds-assets/bds/` and stage it again.

There is one app and one source set (`app/src/main`) — the old Super DeepSeek /
ArenaPilot product flavors were removed in the 2026-10-15 cleanup and must not come
back (`engine-arena-branding.test.mjs` fails if a flavor source set reappears).

## Signing and updates

Every release is signed with the same keystore (`app/superdeepseek-release.jks`; the
name is historical). The `BDS_KEYSTORE_PASSWORD`, `BDS_KEY_ALIAS` and
`BDS_KEY_PASSWORD` environment variables override the defaults. Keep the keystore,
`applicationId` (`com.arenadeck.app`) and signing config unchanged from now on. They
are what let a new APK install as an update over an existing one. `versionCode` is
`1000 + build id` and always increases in CI.

## Source map

| File | Responsibility |
|---|---|
| `MainActivity.kt` | WebView setup, engine injection (`onPageFinished`), boot overlay, file pickers, Back handling |
| `WebViewBridge.kt` | The `AndroidBridge` JavaScript interface (storage, pickers, fetch, downloads, haptics, theme, sandbox) |
| `UiPolish.kt` | Mobile layout polish script injected after the engine |
| `UpdateChecker.kt` | GitHub Releases update check (new version or newer CI build), size/sha256-verified download |
| `Sandbox.kt`, `SandboxTools.kt`, `SandboxService.kt`, `TarGz.kt` | The built-in Linux sandbox (proot + Alpine), its agent tools and the foreground service |
| `StudioActivity.kt` | Linux Studio: terminal, file browser and preview |
| `Downloads.kt` | Where Android 8–9 downloads go (shared Downloads, or the app's own folder without the permission) |
| `Utf8Chunker.kt` | Streams process output as UTF-8 without breaking characters split between reads |
| `src/main/bds-assets/bds/` | The engine bundle: `injected.js`, `content.js`, `content.css`, sandbox pages |
| `src/test/` | Unit tests: bridge, pickers, navigation and link routing, keyboard insets, user agent, polish script, updates |

The Kotlin namespace is the historical `com.superdeepseek.app` (it predates the
ArenaPilot identity and only names the classes); the application id, the app name and
all user-facing text are ArenaPilot's. The theme id `Theme.SuperDeepSeek` is likewise
internal and invisible to users.
