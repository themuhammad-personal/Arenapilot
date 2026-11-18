# Phase 1 — Audit ও Cleanup (অসম্পূর্ণ / Draft)

> অবস্থা: **Kotlin/native/manifest/build/CI-ফাইল অপসারণ সম্পন্ন ও Gradle দিয়ে যাচাই**; JS-এর ভেতরের sandbox glue, কিছু test হালনাগাদ, README ও licence নোটিশ **বাকি**। নিচে প্রতিটি দাবি প্রমাণসহ।

## ১. মূল আবিষ্কার
- `bds/sandbox.js` + `sandbox.html` **PRoot সেতু নয়**। এটি better-deepseek-এর browser iframe, যা `content.js`-এ `chrome.runtime.getURL("sandbox.html")` দিয়ে লোড হয় এবং **DOCX / XLSX / PPTX তৈরি** ও **in-browser CODE_RUNNER (JS/Python/TS/Lua/Ruby)** চালায় (`content.js` কম্পোনেন্ট `CBe`/`DBe`/`PBe`/`Zit`)। তাই **মোছা হয়নি** (মুছলে docs ফিচার ভাঙত)। → Open Question।
- প্রথম-turn prompt জোড়া হয় `injected.js`-এ `function O(...)` (`<ArenaPilot>\n${config.systemPrompt}${addendum}\n</ArenaPilot>`), `config.systemPrompt` আসে `content.js`-এর `du=sdsIsArena()?window.__sdSite.arenaPrompt:sdsLegacyPrompt` seam থেকে; modality `injected.js` `sdsArenaModality(body.modality)`; "প্রথম turn" = `sdsFirstTurn` (`api.firstTurnPath`)। skills/project/memory/persona/MCP-schema একই `O`-তে আলাদা অংশ হিসেবে জোড়া হয়।
- `injected.js` (মিনিফাইড, ~line 376) MCP schema অংশে একটি `## Your Linux sandbox` শাখা আছে — শুধু `serverUrl`/`serverName` = "sandbox" থাকলে সক্রিয়। native সার্ভার সরানোয় এখন নিষ্ক্রিয়, কিন্তু ব্যবহারকারী নিজের MCP server "sandbox" নাম দিলে ভুল লেখা আসবে → Phase 2A-তে seam দিয়ে সরানো দরকার।
- content.js-এর পঠনযোগ্য উৎস রিপোতে নেই (upstream: EdgeTypE/better-deepseek v0.1.14); `scripts/bds-sync.sh` শুধু build-করা bundle সিঙ্ক করে।

## ২. যা করা হয়েছে (প্রমাণ: `./gradlew assembleDebug testDebugUnitTest` সফল)
- মোছা Kotlin: `Sandbox, SandboxService, SandboxTools, ShellProtocol, StudioActivity, StudioPreview, StudioSheet, TarGz` + তাদের ৪টি unit test + `ic_studio_*`, `ic_stat_sandbox` drawable + `sandbox_*` string (সব locale)।
- `WebViewBridge.kt`: sandbox bridge method (`sandboxInfo/Context/Reset/Stop/AgentActive`, `openStudio`, sandbox MCP list/call), আলাদা executor, prefs key ধ্রুবক সরানো।
- `MainActivity.kt`: Studio/Service hook সরানো; নতুন `cleanupLegacySandbox()` — `noBackupFilesDir/sandbox` ও prefs `sd_sandbox_enabled/_mode` মোছে। **Memory/Projects/Settings/EngineStore/NativeBlobStore অক্ষত** (স্পর্শ করা হয়নি)।
- Manifest: `FOREGROUND_SERVICE*`, `POST_NOTIFICATIONS`, `StudioActivity`, `SandboxService`, `extractNativeLibs`; `build.gradle.kts`: `jniLibs`/legacy-packaging।
- Build/CI: `build_proot.py`, `fetch_sandbox_deps.py`, `proot-fork-compat.patch`, `sandbox_apk_check.py` (+test), `sandbox-smoke.mjs`; workflow-এর NDK/proot/sandbox ধাপ; `emulator-smoke.sh`-এর sandbox ধাপ।
- স্টপ-গ্যাপ prompt (`sd-site.js`): "LINUX AND MCP" → সাধারণ "MCP TOOLS" (কোনো কাল্পনিক sandbox.run নেই), PLAN.md/PROGRESS.md বাক্য ও LONG_WORK/CODE_RUNNER-এর sandbox বাক্য সরানো, CODE/SEARCH addendum নিরপেক্ষ ("Arena-র অফিসিয়াল পরিবেশে যা আছে শুধু তা")। যাচাই: vm-এ লোড করে `linux|proot|PLAN.md` নেই; একমাত্র "sandbox" শব্দ = "ArenaPilot adds no sandbox" (ইচ্ছাকৃত নেতিবাচক বাক্য)।

## ৩. আগে/পরে
| | আগে | পরে |
|---|---|---|
| debug APK | 6,993,844 B | 6,839,234 B (−154,610) |
| unit test (Gradle) | 323 পাস | build + test সফল (পুনর্গণনা হয়নি; ৪টি test ফাইল মোছায় সংখ্যা কমেছে) |
| inject prompt ≈token (আগে: Text 1631 · Code 1878 · Search 1803 · Image 0) | — | text 1535 | code 1756 | search 1670 | image 0 (`node scripts/v3-baseline-prompts.mjs`, স্টপ-গ্যাপের পর) |
- release APK-র native lib (proot) আগে/পরে মাপা যায়নি (CI-তে যুক্ত হতো; এখন আর যুক্ত হয় না)।

## ৪. বাকি / ভাঙা (সৎ তালিকা)
JS test (আগে পাস, এখন ব্যর্থ — আমার পরিবর্তনের ফল; ইচ্ছাকৃত হালনাগাদ বাকি):
- `engine-agent-playbook` (২টি), `engine-native-smoke` (১), `engine-arena-branding` (১) — sandbox/LINUX/PLAN.md টেক্সট ধরে নেওয়া assertion।
- `engine-arena-ci`: `emulator-smoke.sh`/workflow-এর বিষয়বস্তু-নির্ভর ~১৪টি test (#1,6,8,16,28–34,37,42) — script কাটার পর anchor মিলছে না। (#26 Pillow আগে থেকেই পরিবেশ-জনিত।)
- `engine-arena-cdp` পরিবেশ-জনিত (Node 20)।
বাকি কাজ: `sd-agent.js`-এর sandbox glue (৯০KB, সাধারণ agent loop-এর সঙ্গে মিশ্র — নিরাপদভাবে আলাদা করতে পড়ে-বুঝে পরিকল্পনা দরকার; এখন native সেতু না থাকায় `sandboxInfo()` ফাঁকা → `sandboxServers()=[]`, attach-card/page অদৃশ্য, কিন্তু **এই নিষ্ক্রিয়তা test দিয়ে যাচাই হয়নি**), `tools/harness`, `docs/licenses/SANDBOX-NOTICE.md`, README, `release-hygiene`, `network_security_config.xml` মন্তব্য (localhost cleartext MCP-র জন্য রাখা), grep-প্রমাণ।

## ৫. Open Questions
1. `sandbox.js` (DOCX/XLSX/PPTX + browser CODE_RUNNER) রাখা হলো। Text Mode-এ CODE_RUNNER রাখবেন কি? (ডিফল্টে বিদ্যমান আচরণ।)
2. `injected.js`-এর "Your Linux sandbox" শাখা seam দিয়ে নিষ্ক্রিয় করব?
3. `docs/PLAN.md` মূল রিপোতে মোছা — V3 plan নতুন করে লিখব?
