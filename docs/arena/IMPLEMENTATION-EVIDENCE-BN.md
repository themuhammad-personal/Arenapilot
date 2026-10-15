# Arena Deck — implementation ও প্রমাণের খাতা

তারিখ: ২০২৬-১০-১৪ · শাখা: `arena/7401e440-super-deepseek`

**এটি final/release-ready ঘোষণা নয়।** অনুমোদিত `FINALIZATION-PLAN-BN.md` অনুযায়ী implementation চলছে। UI দেখা, fake bridge, native execution এবং model-এর আসল tool loop আলাদা প্রমাণ।

## নিশ্চিত পরিবর্তন

| পরিবর্তন | ত্রুটি ও সংশোধন | প্রমাণ / সীমা |
|---|---|---|
| Native launch gate (`14cb8e1`) | প্রথম লঞ্চের logcat মুছে যেত; মৃত process-এর পাশে নোটিশ না থাকাও persistence success হতে পারত। দুই launch log, তিন phase-এর PID/exit-info, am-start error এবং strict unreadable-UI failure যোগ করা হয়েছে। Arena emulator এখন required। | fake-adb regression; CI `38502900292`-তে দুইবারই process alive। আগের `54744fb` process-loss-এর মূল কারণ এখনো অজানা। |
| Required CDP runtime (`dc977aa`) | CDP না চললেও exit 0-তে success মনে হতে পারত। strict mode-এ site profile, engine, composer, একটিমাত্র + এবং বাস্তব pointer click-এ sheet খুলতে হবে। | CI `38503465333` success। এটি message reply বা tool execution প্রমাণ করে না। |
| Bounded live message probe (`dc977aa`) | আগে কোনো আসল মেসেজ পরীক্ষা ছিল না। নতুন manual opt-in একটিমাত্র synthetic message পাঠায়; exact request, completed assistant stream ও rendered reply মিলতে হবে। | Node/CDP-double tests। **Live run চালু হয়নি:** `workflow_dispatch` API HTTP 403, Resource not accessible by integration। Push CI-তে কখনো মেসেজ পাঠানো হয় না। |
| Shell execution error (`1339d23`) | `run` non-zero exit হলেও MCP `isError=false` ফিরত; package install-এর stopped result-ও error হতো না। এখন non-zero/timeout/stop সবই error। | Kotlin regression + CI build/unit-test success। Native test আলাদা নিচে। |
| Native runtime packaging (`1339d23`) | পুরোনো emulator APK-তে runtime fetch ধাপই ছিল না। Arena emulator এখন required fetch ও APK-এর চার ABI ELF/dependency/rootfs manifest পরীক্ষা করে। | CI `38503894088`-তে packaging passed। তৎকালীন primary build-এর fetch optional ছিল। নিচের runtime integration update দেখুন; publication policy অপরিবর্তিত। |
| Direct-only mode (`ba13ed2`) | `/c/…` মানেই Direct ধরে অন্য mode-এর reply-ও tool parser-এ যেতে পারত। এখন shared URL-এ composer-এর Direct mode evidence চাই; অজানা/unsupported হলে parsing বন্ধ ও inline notice। | পুরোনো gate-সহ বাস্তব bundle fixture ব্যর্থ; সংশোধিত gate-এ ৭ browser groups passed। Authenticated live conversation এখনো যাচাই বাকি। |
| Crash attribution (`58d3e5b`) | logcat-এর যেকোনো `FATAL EXCEPTION`-কে app crash বলা হতো। CI-তে UiAutomation PID 4887-এর `Bad file descriptor`-কে Arena PID 3576/4960-এর crash বলা হয়েছিল। এখন package/PID মিলিয়ে attribution। | Android CI-র নির্দিষ্ট failure + fake-adb/Python regressions; আসল app crash, native tombstone ও ANR এখনও failure। এটি পুরোনো process-loss ঘটনার কারণ নির্ধারণ করে না। |

## Native Linux পরীক্ষা — chat/model থেকে স্বতন্ত্র

`android/ci/sandbox-smoke.mjs` fresh CI emulator-এ আসল `AndroidBridge` ব্যবহার করে:

1. runtime supported/enabled;
2. tool list;
3. `printf`-এর exact stdout এবং zero exit;
4. `exit 7`-এর error flag;
5. Unicode/quote/backslash-সহ file write → edit → read;
6. নিজস্ব test file cleanup এবং installed state।

কোনো model request নেই। ফলাফলে stage/boolean থাকে; failure-এ শুধু fresh emulator-এর নিজস্ব fixed `printf` command-এর bounded diagnostic থাকে, কোনো chat/model content নয়। একই পরীক্ষার VM fixture-কে native execution বলা হয় না।

**CI evidence (ক্রম অনুযায়ী):**
- `38504700913` / `38505438633`: packaging/bridge/tool-list ঠিক, প্রথম guest command exit 2।
- `38506898759` (`c6a63ab`): verbosity-9 trace-এ guest `mkdir` → busybox → `fork`-এ Android seccomp SIGSYS, PRoot fallback `-ENOSYS` (-38); shell exit 2। এটি অনুমান নয়, syscall trace evidence।
- `a4bd6c5`: SHA-pinned upstream PRoot source, legacy fork/vfork → clone compatibility patch, matching loader ও NDK 27.2.12479018 দিয়ে চার ABI build। Android seccomp/SELinux/targetSdk শিথিল করা হয়নি।
- `38508109040`: upstream out-of-tree make path bug; `1bd73f5`-এ isolated in-tree ABI builds।
- `38508299620`: upstream ashmem source-এ missing string.h declarations; `15dc614`-এ precise include fix। GPL text, original source archive, patch ও build scripts generated APK assets-এ যুক্ত।
- **`38508527335`, commit `15dc614`: overall SUCCESS। API 34 x86_64 Arena emulator-এ আসল native bridge → Linux probe-এর সব ১০ stage PASS**, stdout, nonzero-error, বাংলা/quotes/backslashes write→edit→read এবং cleanup-সহ। চার ABI build/ELF closure পাস; ARM ফোনে execution এর দ্বারা প্রমাণিত নয়। এই run-এ debug diagnostic tracing enabled ছিল।
- সেই সফল run-এর primary release artifacts এখনও পুরোনো fetched runtime ব্যবহার করেছে: emulator proof-কে ওই release APK-র proof বলা যাবে না।

**Integration `87facaa`, run `38509396120` SUCCESS:** primary APK build-ও একই `--patched-proot`/NDK ব্যবহার করে; dependency fetch আর optional নয়। DeepSeek ও Arena Deck উভয় release APK-তেই চার-ABI runtime checker required। Normal native smoke-এ trace marker বন্ধ; কেবল explicit `SMOKE_PROOT_TRACE=1`-এ diagnostic চালু। API 34 x86_64-এ trace-off native ১০/১০ stage PASS; primary Build & Verify APK-তে উভয় release APK packaging PASS। Release/update publication conditions বদলানো হয়নি; publish job SKIPPED।

## Feature acceptance matrix

| ব্যবহারকারীর প্রয়োজন | এখনকার evidence | Final-এর আগে বাকি |
|---|---|---|
| Plain chat, reply, errors, stop | anonymous composer/runtime Android-এ দেখা; fixture reply flow | actual message/stream/stop/provider error; authenticated Direct Chat |
| Memory/app prompt default off, স্বাধীন opt-in | migration ও fetch/XHR tests; real-bundle fixture | real outbound request-এর verification |
| একটি +, menu, model transition | anonymous Android-এ একটি + ও touch click; remount/style/group replacement fixture | real model switch, keyboard/insets, reload/resume |
| Settings sidebar/fallback | browser fixture; actual Android narrow composer-এ separate bottom-row fallback | সব দৃশ্যমান setting-এর functional persistence; real sidebar lifecycle |
| Direct-only safety | shared conversation URL-এর unit/browser regression ও inline notice | actual conversation mode control contract |
| Visualizer | real bundle → iframe renderer, modelled assistant reply | live model reply → rendered result |
| Linux backend | `15dc614`: actual API 34 x86_64 native ১০/১০ stages PASS | Python package/runtime পরীক্ষা pending; ARM device/security/permissions |
| Model → sandbox → result → final reply | real bundle + fake bridge fixture | lossless raw stream, actual model + native bridge vertical slice |
| Files/documents/charts/download/preview/research/MCP | existing code retained; এই turn-এ পূর্ণ functional acceptance নয় | প্রতিটি visible feature-এর independent end-to-end proof |
| Privacy/security | default-off tests; direct-mode gate | exact raw arguments, abort/session/idempotency, permissions, exports ও fetched-content isolation |
| Final APK | branch builds exist, কোনো release/update publication নয় | zero-blocker commit-matched APK, representative real-device acceptance |

## Live verification চালানোর সীমিত উপায়

বর্তমান GitHub সংযোগ push করতে পারে, কিন্তু workflow dispatch-এ HTTP 403 ফিরেছে। এটি login/CAPTCHA failure নয়; কোনো chat attempt-ই হয়নি।

Owner যদি GitHub UI থেকে চালান:
- **Actions → Build and Release Android APK → Run workflow**;
- branch: **`arena/7401e440-super-deepseek`**;
- **arena_live_message = true**;
- **publish = false** অবশ্যই;
- নতুন anonymous emulator-এ একটি message; account/password/token লাগবে না;
- login/WAF/rate limit হলে ব্যর্থ হিসেবে report করবে; bypass বা automatic retry নয়।

অথবা Arena-এর GitHub connection-এ Actions write/dispatch permission ঠিক করতে হবে। Secret বা credential chat-এ দেওয়ার প্রয়োজন নেই। Private/authenticated data capture দিয়ে এই সীমা পাশ কাটানো হবে না।

## Local verification (শেষ সম্পন্ন suite)

- `npm test`: **28/28 template + 359/359 engine**, কোনো skip নেই (`58d3e5b` application changes + harness-report regression; subsequent native diagnostics targeted tests passed)।
- Arena browser fixture: **৭ PASS groups**।
- DeepSeek browser fixture: **৭ PASS, ২ SKIP, ০ FAIL**; পুরোনো summary ভুল করে ৯ passed বলত। Skipped settings-pages/sheets-drag live proof নয়।
- Lint: **০ errors, ২১ existing warnings**।
- APK/launch/crash Python regressions Node suite-এর মধ্যেও চলে।

পরবর্তী ফলের জন্য এই খাতার নিচে commit/run-specific entry যোগ করতে হবে; আগের ফলকে নতুন commit-এর ফল বলা যাবে না।

## আরও সংশোধন

- `3a27057`: DeepSeek harness-এর skipped scenario আর pass হিসেবে গণনা হয় না; skip-এর সঙ্গে assertion failure থাকলে সেটিও লুকানো যাবে না। পুনরায় harness: ৭ pass, ২ skip, ০ fail।
- `6662c63`: Alpine community repository যোগ করার Kotlin expression আগে base URL এবং `/community` দুটি আলাদা list entry বানাত। এখন একটি পূর্ণ URL; commented-out repository-কে enabled ধরা হয় না। Kotlin regression যুক্ত; `38506145690` Build & Verify APK/unit tests passed। এটি `printf` exit-2-এর কারণ হিসেবে দাবি করা হচ্ছে না।

যদি GitHub UI-তে branch-specific input না দেখা যায়, Actions-write অনুমতিসম্পন্ন owner-এর CLI command:

```sh
gh workflow run build-and-release-apk.yml \
  --repo themuhammad-personal/Super-Deepseek- \
  --ref arena/7401e440-super-deepseek \
  -f arena_live_message=true -f publish=false
```

এটি permission/configuration action; ব্যবহারকারীকে debugging বা credential সরবরাহ করতে বলা হচ্ছে না।

## পরের functional gate (ফল pending)

- Agent Stop আগে website reply থামাতে শুধু DeepSeek icon খুঁজত। Arena-তে profile-defined official composer control খোঁজে; hidden/disabled/ambiguous/unrelated/tool-UI control ক্লিক করে না। DeepSeek branch unchanged। Regression আগে FAIL, patch-এর পরে PASS। **Arena stop label/stream cancellation এখনও live-verified নয়।**
- Native probe-এ `install_packages(['python3'])` এবং actual Python process দিয়ে edited file পড়া/`6*7`-এর exact output যাচাই যুক্ত; কোনো model send নেই। Timeout bounded; package failure বা Python error কখনো successful shell test-এর আড়ালে থাকবে না। Emulator result আসা পর্যন্ত এগুলো fixture proof মাত্র।

## Local revalidation after Stop/Python changes

- পূর্ণ `npm test` (`PYTHONPATH=/home/user/python-libs`): **28/28 template + 362/362 engine, 0 fail, 0 skip**। Python packaging/native-patch C harness regressions এর অন্তর্ভুক্ত।
- প্রথম full run-এ Stop fixture-এর temporary strict query mock boot timer-এ বেঁচে থাকায় asynchronous test failure হয়েছিল; Stop assertion-এর পরে mock restore করা হয়েছে। Agent-only 36/36 এবং তারপর পূর্ণ suite পাস। এটি আড়াল করা skip নয়।
- পরিবর্তিত JS lint: 0 errors; agent test-এর আগে থেকে থাকা unused `engine` warning বহাল।

## Python runtime proof ও নতুন launch failure

- `56a76f5`, run `38510319492`: **Arena API 34 x86_64 emulator-এর ১২/১২ native stage PASS**, real Alpine Python package install এবং Python দিয়ে edited file পড়া/42 output-সহ। একই run-এর primary build unit-test mock failure-এ ব্যর্থ (উপরের corrected regression); overall success বলা হচ্ছে না।
- `7f9f901`, run `38510532054`: Arena native probe **চালানো হয়নি**—second launch-এ PID অনুপস্থিত; strict gate সঠিকভাবে failed। Logcat: `Killing 5259:com.arenadeck.app ... depends on provider com.google.android.gms/.fonts.provider.FontsProvider in dying proc com.google.android.gms.persistent`। এটি এবারকার process-loss-এর নির্দিষ্ট OS kill reason; পুরোনো সব launch failure-এর কারণ হিসেবে সাধারণীকরণ নয়।
- AppCompat-এর transitive EmojiCompat initializer default-এ downloadable font provider ব্যবহার করে। Arena-only manifest-এ AndroidX-এর documented opt-out দিয়ে **শুধু EmojiCompatInitializer metadata সরানো**, অন্য Startup initializer/provider এবং DeepSeek flavor অক্ষত। Native emoji-তে OS font fallback; bundled native fonts ও WebView text rendering বদলানো নয়। Reference: https://github.com/androidx/androidx/blob/androidx-main/emoji2/emoji2/src/main/java/androidx/emoji2/text/EmojiCompatInitializer.java ।
- নতুন gate debug ও primary Arena release APK-র **compiled merged manifest** পরীক্ষা করে; initializer রয়ে গেলে বা manifest পড়া না গেলে failure। Source XML ও compiled-dump negative regressions-সহ Python ৮/৮; focused native JS ৫/৫। পরিবর্তনের Android result pending; lifecycle stability এখনও final ঘোষণা নয়।
