# Arena Deck — গোড়া থেকে final পর্যন্ত কাজের পরিকল্পনা

তারিখ: ২০২৬-১০-১৪
শাখা: `arena/7401e440-super-deepseek`
অবস্থা: implementation চলছে; final নয়। বর্তমান fix/CI/blocker-এর হিসাব: [IMPLEMENTATION-EVIDENCE-BN.md](IMPLEMENTATION-EVIDENCE-BN.md)। নিচের §২ planning-time baseline, বর্তমান CI gate নয়।

## ১. কাজের সংজ্ঞা

গোড়া থেকে শুরু মানে পুরোনো কোড অন্ধভাবে ফেলে দেওয়া নয়। প্রতিটি requirement,
site-specific assumption এবং “কাজ করে” দাবি নতুন করে যাচাই হবে। আগের fixes সংরক্ষিত
থাকবে, কিন্তু regression test ও বাস্তব প্রমাণ ছাড়া সেগুলোকে final ধরা হবে না।

স্থির সিদ্ধান্ত:
- নতুন অ্যাপ/ব্র্যান্ড Arena Deck; Super DeepSeek flavor-এর আচরণ অনিচ্ছাকৃতভাবে বদলানো যাবে না।
- প্রথম final scope: arena.ai **Direct Chat**। Battle/Side-by-side/Agent-এর জন্য স্পষ্ট unsupported notice এবং নিরাপদ pass-through।
- app instructions এবং stored memory পৃথক opt-in, ডিফল্টে বন্ধ। নতুন branding/model-neutral prompt।
- website-এর নিজস্ব login, model selection ও request flow বজায় থাকবে; private API অনুমান করে আলাদা chat client বানানো হবে না।
- model-কে tool নির্দেশনা দেওয়া, tool-এর অনুমতি, native runtime উপস্থিতি এবং UI-তে tool দেখা—চারটি আলাদা বিষয়।
- এখন release/update channel বা publication নয়।

## ২. নতুন baseline: CI-র সবুজ রং যথেষ্ট নয়

Run `38492868080`, code commit `54744fb`:
- overall conclusion: success;
- Build & Verify APK, Arena adapter integration, DeepSeek harness ও DeepSeek emulators: success;
- **Arena Deck API 34 emulator: failure**;
- annotation: `app process is not alive after launch (crash during startup?)`;
- CDP probe skipped: process id না থাকায় WebView socket পাওয়া যায়নি।

Emulator job-এ `continue-on-error: true` আছে। তাই run-এর success-কে Arena Deck-এর
সফল launch বলা যাবে না। এখনো crash-এর কারণ প্রতিষ্ঠিত নয়; crash, OS kill, process
lookup বা timing—প্রমাণ দিয়ে আলাদা করতে হবে। নতুন narrow-composer placement-ও এই
run থেকে live-site verified বলা যাবে না।

আরেকটি finalization blocker: sandbox dependencies fetch ব্যর্থ হলেও release build
চলতে পারে। sandbox feature final বলতে runtime সত্যিই APK-তে আছে এবং ডিভাইসে চলে,
এ দুটো আলাদা করে পরীক্ষা করতে হবে। এটি সর্বশেষ run-এ runtime অনুপস্থিত থাকার দাবি নয়।

## ৩. প্রতিটি ফিচারের হিসাব

একটি feature acceptance matrix-এ থাকবে:

`ফিচার → ব্যবহারকারীর প্রত্যাশিত ফল → কোড-পথ → dependency/permission → বর্তমান ত্রুটি → test → বাস্তব evidence → বাকি কাজ`

অবস্থা শুধু:
- অযাচাইকৃত;
- ত্রুটি পুনরুৎপাদিত;
- fix করা, local test পাস;
- live/Android-এ যাচাইকৃত;
- blocked (কারণসহ);
- final scope-এর বাইরে (সিদ্ধান্তসহ)।

টেস্টের সংখ্যা বা UI দৃশ্যমানতা থেকে completion percentage বানানো হবে না।

## ৪. কাজের ক্রম ও প্রতিটি ধাপের exit condition

### ধাপ ০ — requirements, inventory, baseline

- Android shell, injection order, site adapter, config/storage, network hooks,
  message parser, tool dispatcher, native bridge, runtime এবং UI-এর dependency map।
- Settings ও + sheet-এর প্রতিটি visible feature তালিকাভুক্ত করা।
- code বনাম shipped APK বনাম tested commit মিলিয়ে evidence ledger।
- পুরোনো tests কী প্রমাণ করে এবং কী বাদ দেয় তা লেখা।

**Exit:** সব visible feature-এর owner/code-path/dependency/test gap জানা; critical
blockers-এর অগ্রাধিকার নির্ধারিত। Baseline CI inspection এই সেশনে শুরু হয়েছে।

### ধাপ ১ — নির্ভরযোগ্য native launch ও সঠিক quality gate

- Arena emulator-এর process-loss পুনরুৎপাদন; logcat/exit reason/launch timing দিয়ে
  native crash, renderer failure, OS kill এবং test-script error আলাদা করা।
- cold launch, relaunch, existing-install upgrade, first-use notice, resume পরীক্ষা।
- release/debug asset staging এবং sandbox runtime presence যাচাই।
- অপরিহার্য acceptance checks-এ failure যেন overall success-এ চাপা না পড়ে;
  flaky test হলে কারণ ও সীমিত retry নীতি নির্ধারণ, অন্ধ rerun নয়।

**Exit:** Arena launch পরীক্ষা নির্ভরযোগ্য; কোনো অজানা process-loss/crash খোলা নেই;
প্রয়োজনীয় gate ব্যর্থ হলে candidate গ্রহণযোগ্য নয়।

### ধাপ ২ — আসল Arena-এর আচরণ থেকে adapter contract

- privacy-safe, manual, bounded live-message probe: একটি ছোট synthetic message;
  explicit run ছাড়া প্রতি push-এ বার্তা পাঠানো নয়।
- composer/model switch/new chat/history navigation, actual request shape,
  streamed response framing, stop/error এবং conversation id-এর প্রমাণ।
- logged-out ও authenticated অবস্থার evidence আলাদা রাখা।
- DOM selectors ও transport adapter-এর versioned contract; অচেনা shape হলে
  native chat অক্ষত রেখে engine extras বন্ধ ও স্পষ্ট diagnostic।
- personal chat, token, cookie বা raw private content diagnostics-এ না রাখা।

**Exit:** current site-এর actual contract জানা; fixture assumptions স্পষ্ট; auth বা
site access blocked হলে কারণ নথিভুক্ত, modelled test দিয়ে ঘাটতি ঢেকে দেওয়া নয়।

### ধাপ ৩ — সাধারণ chat নির্ভরযোগ্য করা

- সাধারণ message → reply; new chat; model switch; reload/history reopen।
- stream completion, cancellation, timeout, network failure এবং provider error
  আলাদা state; retry-তে duplicate request বা tool execution নয়।
- একটি +; সঠিক native upload input; Settings sidebar placement; narrow-screen
  composer/Send bounds; native settings/menu আচরণ অক্ষত।
- unsupported mode-এ কোনো single-chat tool loop নয়।

**Exit:** plain chat engine extras ছাড়াই নির্ভরযোগ্য; failure দৃশ্যমান ও recoverable;
model/session পরিবর্তনে UI বা state অন্য chat-এ ছড়ায় না।

### ধাপ ৪ — একটি সম্পূর্ণ tool loop, তারপর feature-by-feature

প্রথম vertical slice:

`user request → opted-in tool instructions → actual assistant stream → completed tool call → permission check → native execution → exact result → composer follow-up → verified final reply`

- bounded raw-stream handling; split UTF-8/JSON/tag, malformed/truncated replies;
  reasoning/quoted user text/tool results থেকে command execution নয়।
- Markdown-rendered text থেকে code উদ্ধারকে lossless ধরে নেওয়া যাবে না।
- duplicate detection, session isolation, Stop, timeout, ask/auto permission,
  reload/re-render-এ পুরোনো command পুনরায় না চালানো।
- native sandbox-এ ছোট harmless command, file write/read এবং ফল মিলিয়ে দেখা।
- Visualizer iframe-এ বাস্তব render, interaction, refresh/error recovery।

এরপর matrix অনুযায়ী: Camera/Photos/Files → folder/project → file generation/export →
web/repository fetch → MCP → Deep Research → সংশ্লিষ্ট settings/memory/persona/skills।
ক্রম dependency ও ঝুঁকি অনুযায়ী বদলাতে পারে, কিন্তু কোনো feature বাদ যাবে না অঘোষিতভাবে।

**Exit:** প্রতিটি in-scope feature-এর happy path ও failure path বাস্তবে যাচাই। এক মডেলে
কাজ করাকে সব মডেলের নিশ্চয়তা বলা হবে না; নির্বাচিত representative models ও tested
limitations নথিভুক্ত হবে। model protocol না মানলে মিথ্যা success নয়।

### ধাপ ৫ — settings, privacy ও branding-এর পূর্ণ সংযোগ

- প্রতিটি setting সত্যিই runtime বদলায় কি না; save/reload/restart/upgrade persistence।
- privacy toggle স্বাধীন; disabled state-এ অনিচ্ছাকৃত context injection নয়;
  instructions চালু করলে memory নিজে থেকে চালু নয়।
- native runtime অনুপস্থিত/permission denied/network unavailable হলে UI-তে কারণ।
- Arena-তে অপ্রযোজ্য DeepSeek feature শনাক্ত; চুপচাপ fake কাজ, ভুল দাম/পরিচয় বা
  নিঃশব্দে বাদ নয়। scope পরিবর্তনের প্রয়োজন হলে সিদ্ধান্ত নেওয়া হবে।
- app-owned labels, prompts, help/error/export text-এ Arena Deck identity;
  compatibility protocol identifiers অযথা rename নয়।

**Exit:** visible controls ও বাস্তব আচরণ সামঞ্জস্যপূর্ণ; privacy/security contract পরীক্ষা পাস।

### ধাপ ৬ — সমন্বিত Android ও real-device acceptance

- fresh install ও upgrade; process death/restart; rotate/background/resume;
  back gesture/keyboard; ছোট-বড় screen; theme; দীর্ঘ reply।
- file picker/camera/storage permission; বড় file ও interrupted download;
  sandbox install/failure/stop/restart; sensitive bridge trust checks।
- auth/account-specific এবং real-device touch journey-র প্রমাণ। যেটি এখানে করা যায় না
  সেটি স্পষ্টভাবে blocked; প্রয়োজনে মালিকের কাছ থেকে ন্যূনতম targeted interaction,
  password/token নয়, পুরো debugging-এর দায় হস্তান্তর নয়।
- DeepSeek flavor regression suite পাশাপাশি।

**Exit:** agreed device/OS coverage পূরণ; unresolved critical/high-severity bug নেই;
পরীক্ষা এড়িয়ে যাওয়া বা report-only success-কে pass বলা হয়নি।

### ধাপ ৭ — release candidate, final verdict, তারপর publication সিদ্ধান্ত

- নির্দিষ্ট commit থেকে APK; package/version/signature/runtime assets পরীক্ষা।
- একই build-এর acceptance matrix এবং evidence পুনর্মিলন।
- blocker শূন্য, supported/unsupported behavior ও অবশিষ্ট non-blocking সীমা লেখা।
- final acceptance-এর পরেই release/update channel নিয়ে মালিকের সিদ্ধান্ত।

**Exit:** final বলতে usable, reproducibly tested candidate—শুধু installable APK নয়।

## ৫. প্রতিটি পরিবর্তনের কাজের চক্র

১. bug/requirement নির্দিষ্ট করা।
২. পুরোনো আচরণ পুনরুৎপাদন বা evidence নেওয়া।
৩. ছোট, site-scoped পরিবর্তন।
৪. regression test; সম্ভব হলে fail-before/pass-after।
৫. unit → real-bundle browser → Android → live feature evidence, প্রযোজ্য স্তরে।
৬. অন্য flavor ও পাশের feature ভাঙেনি যাচাই।
৭. matrix/known issues/evidence আপডেট; tested commit অনুযায়ী build।

কোনো gate blocked হলে সেই ধাপ “done” নয়। অন্যান্য independent কাজ চলতে পারে,
কিন্তু তার উপর নির্ভরশীল পরের milestone-কে complete বলা যাবে না।

## ৬. রিপোর্টের নির্দিষ্ট বিন্যাস

প্রতি কাজের সেশনের শেষে:
- কোন milestone নিয়ে কাজ হয়েছে;
- কী সমস্যা প্রমাণিত এবং কী পরিবর্তন হয়েছে;
- কোথায় পরীক্ষা হয়েছে—unit/fixture/emulator/live/phone;
- কী এখনও ব্যর্থ, skipped বা অজানা;
- tested commit/APK/CI run;
- পরবর্তী নির্দিষ্ট কাজ এবং কোনো user action সত্যিই লাগবে কি না।

বর্তমান প্রথম engineering task: **Arena API 34 launch-এর process-loss diagnosis এবং
truthful acceptance gate**। পুরো codebase rewrite বা আরও cosmetic UI দিয়ে শুরু নয়।
