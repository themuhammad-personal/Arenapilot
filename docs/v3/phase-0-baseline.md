# Phase 0 — ভিত্তিরেখা ও সুরক্ষা

Base commit: `9626dcf3b18abd4315b72ac4edd8c1a20fa93577` (main) — tag `pre-v3-sandbox`.
পরিবেশ: sandbox container, Linux x64, 2 vCPU / 2 GB RAM, Node v20.20.2, JDK 17 (Temurin), Android SDK 34 / build-tools 34.0.0, Gradle 8.7 (wrapper).

## ১. test ফলাফল

| কমান্ড | ফল |
|---|---|
| `npm ci` | সফল |
| JS test (`scripts/*.test.mjs`, `android/app/src/test/js/*.test.mjs`, `models/*.test.mjs`) — প্রতিটি ফাইল আলাদা `node --test` | ৪১ ফাইলের মধ্যে ৩৯ সম্পূর্ণ পাস; ২টি পরিবেশ-জনিত (নিচে) |
| `cd android && ./gradlew testDebugUnitTest` | **সফল** — ৩২ suite, ৩২৩ test, ০ fail |
| `cd android && ./gradlew assembleDebug` | **সফল** |
| `assembleRelease` | এই রানে চালানো হয়নি (নিচে "মাপা যায়নি") |

### আগে থেকে ব্যর্থ/অসম্পূর্ণ (আমাদের পরিবর্তনের দোষ নয় — কোড বদলানোর আগের `main`)
1. `engine-arena-cdp.test.mjs` — `ReferenceError: WebSocket is not defined` (`android/ci/cdp_probe.mjs:68`). Node 20-তে global `WebSocket` নেই; CI `node-version: 22` ব্যবহার করে (`.github/workflows/build-and-release-apk.yml`)। ফলে test ঝুলে যায় (timeout)। **পরিবেশ-জনিত**, Node 22-এ চালালে সমাধান হওয়ার কথা — এই রানে Node 22 দিয়ে যাচাই করা হয়নি।
2. `engine-arena-ci.test.mjs` — ৪৬টির মধ্যে ৪৫ পাস; `apk_check.py: accepts the right APK and rejects every wrong one (needs Pillow)` ব্যর্থ। test নিজেই "needs Pillow" বলছে; এই পরিবেশে Pillow/aapt-জনিত। **পরিবেশ-জনিত**।
- `engine-arena-health`, `engine-arena-coverage` প্রথমবার timeout হয়েছিল কারণ Gradle একসঙ্গে চলছিল (২ vCPU); একা চালালে পাস (১৫/১৫, ৬/৬)।
- নোট: প্রথম Gradle চেষ্টায় daemon মেমরিতে মারা যায় (২ GB RAM)। পরে `-Xmx900m`, `maxParallelForks=1` init-script দিয়ে চালিয়ে সফল।

## ২. আকার

| বস্তু | আকার (বাইট) |
|---|---|
| `app-debug.apk` | 6,993,844 (≈ 6.67 MiB) |
| `content.js` | 3,355,954 |
| `sandbox.js` | 1,219,979 |
| `injected.js` | 69,095 |
| `sd-agent.js` | 89,700 |
| `sd-site.js` | 61,754 |
| `sd-native.js` | 36,601 |

- debug APK-তে কোনো `.so` নেই (`unzip -l` = 0): `proot` ও সংশ্লিষ্ট native lib রিপোজিটরিতে নেই, CI-তে `scripts/fetch_sandbox_deps.py`/`build_proot.py` দিয়ে release-এর সময় যুক্ত হয়। তাই **release APK-তে sandbox-এর আসল ভার এখানে মাপা যায়নি** (CI artifact দরকার)।

## ৩. আজকের inject-করা prompt (ভিত্তিরেখা)

পদ্ধতি: `node scripts/v3-baseline-prompts.mjs` — vm-এ আসল `sd-site.js` লোড; `injected.js`-এর নিয়মে
`<ArenaPilot>\n{ARENA_PROMPT}\n\n{addendum}\n</ArenaPilot>` বানানো (ফাইল: `docs/v3/baseline-prompts/{text,code,search,image}.txt`, `summary.json`)।

| মোড | modality | অক্ষর | আনুমানিক token (÷4) |
|---|---|---|---|
| `ARENA_PROMPT` একা | — | 6,496 | 1,624 |
| Text | chat | 6,523 | 1,631 |
| Code | webdev | 7,512 | 1,878 |
| Search | search | 7,211 | 1,803 |
| Image | image | 0 | 0 (`inject:false`) |

সীমাবদ্ধতা: এটি শুধু system block। skills/project/memory/persona/MCP schema অংশ আলাদা জোড়া হয় (`injected.js` `function O`) এবং ডিফল্টে বন্ধ/ফাঁকা, তাই ভিত্তিরেখায় ধরা হয়নি।

## ৪. যা যাচাই হয়নি
- প্রকৃত ডিভাইস / emulator / Arena লগইনে কিছু চালানো হয়নি।
- Node 22-তে `cdp`/`ci` test; release APK আকার।
