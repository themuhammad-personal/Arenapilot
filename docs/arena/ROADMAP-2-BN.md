> **Implementation update:** বর্তমান code changes, required gates ও native/Linux/live-chat blockers-এর প্রমাণ [IMPLEMENTATION-EVIDENCE-BN.md](IMPLEMENTATION-EVIDENCE-BN.md)-এ। এই roadmap-এর পুরোনো status-কে সর্বশেষ ফল ধরা যাবে না।

# Arena Deck — কার্যকারিতা পুনর্গঠন

> **বর্তমান master plan:** [গোড়া থেকে final পর্যন্ত](FINALIZATION-PLAN-BN.md)। সর্বশেষ CI `38492868080` overall success হলেও Arena Deck emulator job ব্যর্থ: launch-এর পর process পাওয়া যায়নি; CDP skipped। তাই পরবর্তী প্রথম অগ্রাধিকার native launch diagnosis ও বাধ্যতামূলক acceptance gate। নিচের milestone/progress বিবরণ আগের কাজের evidence হিসেবে বহাল।

তারিখ: ২০২৬-১০-১৪ · শাখা: `arena/7401e440-super-deepseek`

## নতুন ভিত্তি

আগের REPORT-BN.md একটি ঐতিহাসিক port/smoke রিপোর্ট, production readiness-এর প্রমাণ নয়। মালিকের ফোনে পরীক্ষা: model switch-এ দুটি `+`, স্থায়ী floating Settings, Sandbox/Visualizer নিষ্ক্রিয়, মাঝে মাঝে উত্তর-ত্রুটি। এটাই বর্তমান product baseline। ফিচার দেখা যায় ≠ ফিচার কাজ করে।

### গৃহীত সিদ্ধান্ত

- Arena-তে hidden instructions এবং stored memory ডিফল্টে বন্ধ; settings থেকে পৃথকভাবে চালু করা যাবে। পুরোনো install-ও একবার safe-default migration পাবে, ডেটা মুছবে না।
- Arena Deck-এর নতুন, model-neutral prompt; SDS tags compatibility protocol, ব্র্যান্ড/মডেলের পরিচয় নয়।
- real-message smoke হবে opt-in, bounded/manual; প্রতি push-এ বার্তা নয়। credentials/recaptcha bypass নয়।
- release/update channel অপরিবর্তিত; আগে অ্যাপ final করতে হবে।

## কোড-পাঠে নিশ্চিত ঘাটতি

1. `g1`, `W_`, `Lvt`, `LQ` message scan/classification/mutation tracking-এ DeepSeek DOM hardcoded। profile-এর message selectors মূল scanner পড়েই না। তাই শুধু selector লিখে tool rendering চালু হয়নি।
2. attach mount শুধু parent-এর ভেতরে খোঁজে; parent বদলালে পুরোনো instance থেকে যেতে পারে। native button-এর style reset/new node-ও reconcile করতে হবে।
3. Settings rail ইচ্ছাকৃতভাবে fixed left-middle, sidebar integration-এর বিকল্প হিসেবে আগে ship হয়েছে।
4. prompt-disable শুধু single prompt-এ প্রযোজ্য; multi prompt, skills, character, project ও MCP অন্য পথে inject হয়। privacy gate outbound boundary-তেও লাগবে।
5. raw tool-argument recovery `/chat/s/` history-নির্ভর; Arena-তে history fetch বন্ধ। rendered Markdown থেকে code নেওয়া lossless নয়।
6. Arena stream parser/usage/completion lifecycle-এর real transcript প্রমাণ নেই। error cause না জেনে retry করা যাবে না।

## ক্রমানুসারে কাজ এবং গ্রহণযোগ্যতার শর্ত

| ধাপ | কাজ | Done-এর শর্ত |
|---|---|---|
| A | privacy defaults + migration + নতুন prompt | fresh/upgrade/reload/explicit opt-in; fetch ও XHR-এ privacy tests; DeepSeek golden unchanged |
| B | composer lifecycle, Settings docking | remount/style reset/model switch-এ একটি +; sidebar থাকলে সেখানেই Settings, না থাকলে non-floating fallback; native menu অক্ষত |
| C | message processing adapter | user/reasoning/tool-result থেকে tool execution নয়; reversed DOM order; streaming→final; আসল bundle দিয়ে Visualizer এবং Sandbox result-loop fixture tests |
| D | lossless response + lifecycle | bounded stream capture, abort/error/UTF-8/chunks; exact arguments; no duplicate execution/reload; কোনো secret/content diagnostic log নয় |
| E | real Arena smoke | manual একটি ক্ষুদ্র harmless request, request/response shape verification; anonymous এবং authenticated পৃথক evidence; Android native sandbox-এ বাস্তব command result |
| F | feature-by-feature acceptance | files/camera/folder/project/research/visualizer/export/settings persistence; unsupported mode notice; touch/back/theme/rotation |
| G | release candidate | দুই flavor regression, Android build/emulator, real-device core journey; তারপর release বিষয়ে সিদ্ধান্ত |

### পরীক্ষার সত্যতা

- Unit tests = নির্দিষ্ট code contract।
- Chromium fixture = আসল engine + modelled Arena DOM + fake native bridge, live Arena বা Linux execution নয়।
- Emulator launch = boot/injection, feature success নয়।
- live message→tool→native result→follow-up = end-to-end feature evidence।

এই পরিবেশে arena.ai সরাসরি outbound allowlist-এ নেই। local fixture-কে live capture বলা হবে না। পরের live probe CI-তে চালানো যেতে পারে, কিন্তু ব্যর্থ auth/anti-bot হলে থামবে; bypass বা অসীম retries নয়।

## এই দফার বাস্তবায়ন ও বাকি সীমা

### সম্পন্ন (কোড + offline evidence)

- **A:** default-off settings, পুরোনো install-এর একবার migration, নিজের choice পরে অক্ষত, নতুন Arena Deck prompt। outbound fetch/XHR-এ config না এলেও default-off; memory-only-তে অন্য context যায় না। disclosure ও Settings overview আপডেট; upgrade-এ privacy notice আবার আসে। আগের chat-এর পাঠানো context ফিরিয়ে নেওয়া যায় না।
- **B:** attach instance toolbar-এর সঙ্গে সরানো হয়; native style reset/replacement reconcile হয়। floating Settings সরিয়ে semantic sidebar-এ docking, sidebar না থাকলে composer fallback। native Settings untouched। **বাস্তব logged-in sidebar এখনও unverified।**
- **C (আংশিক):** profile message list পড়া, reversed order→chronological, user/assistant classification, mutation rescans, completed widget-এর native prose hide, agent card/reply signature একই node list ব্যবহার করে। tool session key-এর আরও একটি hardcoded `/chat/s/` reader (`eF`) পাওয়া গেছে—এখন আলাদা Arena chat আলাদা key।
- Unknown/missing request mode এখন fail-closed; শুধু `direct-battle`/`direct`-এ opt-in injection। supported URL-এর বাইরে message scanner খালি। unsupported-mode **notice এখনও বাকি**।
- Arena messages-এ DeepSeek-এর দাম ও history-derived timestamp দেখানো বন্ধ রাখা হয়েছে—settings দৃশ্যমান থাকলেও ভুল তথ্য দেখানো চলবে না।
- বাস্তব Chromium fixture-এ plain-chat privacy, + remount/style reset, sidebar drawer, Visualizer iframe-এর HTML, fake sandbox result-loop এবং no-duplicate rescan যাচাই। user message-এর tool-tag execution হয় না। এই fixture network Arena-তে যায় না।
- CI-তে আলাদা `Arena adapter integration` gate যোগ হয়েছে; release job/update channel বদলানো হয়নি।

### পরীক্ষা

- পুরো local suite (সব সংশোধনের পর): engine ৩৩৯/৩৩৯, template ২৮/২৮; Pillow-সহ কোনো skip নেই।
- Arena Chromium integration: ৬টি check-group pass; console runtime error নেই।
- DeepSeek Chromium harness: ৭টি PASS, ২টি SKIP, ০ FAIL। runner-এর পুরোনো summary skipped-গুলোকেও “passed” সংখ্যায় ধরে—সেই সংখ্যা গ্রহণ করা হয়নি।
- Python APK checker-এর unit tests: ১০/১০ (synthetic APK, নতুন APK build নয়)।
- eslint: ০ error, ২১ existing warning। capture-kit-এর দুই baseline lint error behavior-preserving fix করে bookmarklet regenerate করা হয়েছে। brand gate pass।

### পরবর্তী অগ্রাধিকার (এগুলো এখনও সম্পন্ন নয়)

1. **D:** Arena-এর raw assistant stream থেকে exact code/arguments; Markdown-rendered code-এর backslash/formatting বদলে যাওয়ার ঝুঁকি আছে। বর্তমান সফল sandbox fixture-এ সহজ JSON ছিল, arbitrary code নয়। history-based keep-going নাজ কাজ করে না, কারণ Arena history endpoint অজানা; short reply/abort/error state বাস্তব stream দিয়ে পরীক্ষা লাগবে।
2. **E:** manual, bounded live-message smoke বানানো ও চালানো; বর্তমান CI কেবল page-load capture করে, এই দফায় live message পাঠানো হয়নি। নতুন private-data-free transcript না পাওয়া পর্যন্ত real request schema বা unanswered/error-এর কারণ চূড়ান্ত বলা যাবে না।
3. **F:** real phone/native Linux, authenticated sidebar ও message structure, tool-by-tool acceptance, touch/back/rotation, unsupported-mode notice, নিষ্ক্রিয় settings-এ স্পষ্ট capability status।
4. **G:** তখনই final/release candidate—এখন নয়।

**বর্তমান verdict: প্রথম functional repair milestone; production-ready নয়।** নতুন APK/CI ফল আলাদা evidence, offline test-কে তার বিকল্প ধরা হবে না।


### CI-তে ধরা আরও একটি আসল bug: animated Back

প্রথম নতুন CI run `38491593599`-এ `Arena adapter integration` ব্যর্থ হয়। একই
Chromium-কে CI-এর flags-এ লোকালে চালিয়ে পুনরুৎপাদন: attach sheet Back-এ animation
শেষে component state বন্ধ হচ্ছিল না। `sd-sheets.wrapBack` প্রথমে sheet-কে offscreen
সরাত, তারপর `elementFromPoint`-নির্ভর handler ডাকত—সে তখন নিচের page দেখত।
এখন animation-এর আগে close control ধরে রাখা হয়; nested settings Back আগের মতো
ভেতরেই ফিরে, reduced-motion-এর পথও অক্ষত। তিনটি নতুন unit test, প্রথমটি পুরোনো
কোডে fail/নতুন কোডে pass। bundled Chromium reduced-motion force করত বলে আগের local
pass এই bug ঢেকেছিল; Arena harness এখন explicit `no-preference` দিয়ে animation
চালিয়েই পরীক্ষা করে। একই পুরোনো CI run-এর চার emulator job ইতিমধ্যে সফল হয়েছে;
এই তথ্য updated fix-এর নতুন build-এর প্রমাণ নয়।

### আসল anonymous composer capture: সরু স্ক্রিনে Send overflow

প্রথম run-এর Arena emulator CDP annotation-এ form `[17,503,286,88]`, Settings
`[215,549,36,36]`, Send `[311,551,32,32]` দেখা যায়—৩২০px viewport-এ Send-এর শেষ
অংশ বাইরে। এটি এই দফার inline toolbar fallback-এর regression, “সব ঠিক” নয়।
সংশোধন: Settings sidebar না থাকলে **form-এর আলাদা নিচের সারিতে** বসে; native
toolbar-এর বাম group-এ নয়। Harness-এ actual capture-এর মতো Direct/model picker/
দুটি right control যোগ করে ৩২০px viewport-এ Send পুরো form-এর মধ্যে থাকার assertion
পুরোনো placement-এ fail, সংশোধিত placement-এ pass। এই fallback composer-এর উচ্চতা
বাড়ায়; toolbar চেপে দেওয়া বা floating icon দিয়ে ঢেকে রাখার চেয়ে এটি স্পষ্ট ও নিরাপদ।
নতুন capture-তে final placement আবার যাচাই করতে হবে।

Animated-Back fix-এর run `38492340185`-এ `Arena adapter integration` ও DeepSeek
harness সফল—এটি আগের failed gate-এর CI pass-after evidence।
