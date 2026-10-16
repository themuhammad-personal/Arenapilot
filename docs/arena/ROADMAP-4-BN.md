# ArenaPilot — পরিকল্পনা ৪: আসল Arena পেজ-ভিত্তিক এজেন্টিক Android অ্যাপ

তারিখ: ২০২৬-১০-১৬ · বেসলাইন: `main` (`ec3f3ee088b4442effea8a859fab3921ccde4e93`)
মালিকের বর্তমান সিদ্ধান্ত (২০২৬-১০-১৫): **চ্যাটের একমাত্র surface হলো arena.ai-র আসল পেজ—আলাদা Compose chat shell নয়। N0-তে ওই পেজের DOM-এই CSS/JS দিয়ে mobile-first Material-3 skin হবে; arena-র নিজস্ব রং, লগইন ও CAPTCHA অক্ষত থাকবে। UI ইংরেজি-প্রথম (বাংলা অপশন), ডিফল্ট ধাপ-কার্ড + চাইলে লাইভ Computer ভিউ, নিজের MCP সার্ভার (URL দিয়ে), ফোরগ্রাউন্ড সার্ভিস+নোটিফিকেশন এবং Manus-লেভেল ডেলিভারেবল; ফোনের অন্য অ্যাপ নিয়ন্ত্রণ এখন নয়।**

এই পরিকল্পনা [ROADMAP-3-BN.md](ROADMAP-3-BN.md)-এর উত্তরসূরি। রেফারেন্স গবেষণা: Manus AI Android অ্যাপ (Google Play/App Store বিবরণ, ২০২৬), ২০২৬-এর agentic অ্যাপ জরিপ (ChatGPT agent mode, Perplexity Assistant, Claude connectors), ওপেন-সোর্স on-device এজেন্ট (Mobile Agent, DSHBox)।

---

## ০. মালিকের উল্লিখিত সমস্যা → মূল কারণ → সমাধান-স্থান

| # | মালিকের অভিযোগ | মূল কারণ (প্রমাণসহ) | কোন ফেজে মূল সমাধান |
|---|---|---|---|
| ১ | মোবাইল স্ক্রিনে বেমানান, সেটিংস চ্যাটের ভেতরে | অ্যাপের মুখ = arena.ai-এর **ওয়েব পেজ** (মোবাইল-ফার্স্ট নয়) | N0 — অফিসিয়াল ইন্টারফেসে ইনজেক্ট করা Material-3 স্কিন (পেজ-ই মুখ) |
| ২ | লম্বা মডেল-নামে সেন্ড বাটন স্ক্রিনের বাইরে | ওয়েব composer-এ জায়গার দ্বন্দ্ব | N0 — স্কিন করা composer + arena-র নিজের মেনু, মোবাইল-স্টাইলে |
| ৩ | কিছু মডেল একদমই কাজ করে না, অনেকে মাঝে/দীর্ঘে এরর | মডেল-ভেদে ট্যাগ-ফরম্যাট ভিন্নতা, রিয়েল-টাইম এরর সারফেস নেই | N1+N2 — ট্যাগ নরমালাইজার, প্রতি-মডেল রিলায়েবিলিটি ম্যাপ, নেটিভ এরর+রিট্রাই |
| ৪ | **thinking-মডেলে থিংকিং+উত্তর একসাথে, raw কোড** | রিজনিং ট্রেস ও উত্তর আলাদা করে পার্স হয় না; কোড-ফেন্সে মোড়া ট্যাগ পার্সার এড়িয়ে যায় | N0 (রেন্ডার) + N1 (পার্সিং): রিজনিং আলাদা, কোড-ফেন্স স্ট্রিপ, SDS কার্ড |
| ৫ | Direct/Agent ছাড়া অন্য mode-এ PDF/ছবি ছাড়া ফাইল কাজে লাগানো যায় না; code/Office ফাইলও অনেক সময় rejected | Arena mode অনুযায়ী allowlist/`accept` + server-side validation চালায়; Android picker নিজে `*/*` নিতে পারে, কিন্তু তা server acceptance নিশ্চিত করে না। Native bridge text/blob পড়তে পারে; WebView-এ text-like ফাইলের `.txt` fallback আছে, তবে binary formats নয় | N1 — mode-aware capability matrix; অনুমোদিত attachment native পথে, বাকি text/code ও extract-করা documents দৃশ্যমান inline-context card-এ; unsupported binary-র স্পষ্ট fallback |
| ৬ | মোড বদলালে টুল কাজ করে না | Direct-only নীতি (ব্যাটেল/সাইড-বাই-সাইডে দুই মডেল পরস্পর-বিরোধী ট্যাগ দেয়) — সচেতন সিদ্ধান্ত, N0-তে স্পষ্ট নেটিভ বার্তা | N0 — মোড নোটিশ নেটিভ, টুল-অফ ব্যাজ |
| ৭ | স্যান্ডবক্স ঠিকমতো কল করতে পারে না (কমান্ড/আউটপুট/নেটওয়ার্ক সব) | টুল-লুপ স্ক্যানার+নির্দেশনার উপর নির্ভরশীল ছিল — ৪ নং কারণেই ভাঙা; CI-তে স্যান্ডবক্স নিজে ১২/১২ পাস | N1 — নেটিভ স্টেপ-কার্ড পাইপলাইন, লাইভ আউটপুট |
| ৮ | ভিজ্যুয়ালাইজার কাজ করে না | ওয়েব DOM-এ উইজেট ইনজেকশন পথটাই ভঙ্গুর | N1 — নেটিভ কার্ড + স্যান্ডবক্সড WebView (srcdoc), ফুল-স্ক্রিন |
| ৯ | MCP সার্ভার কাজ করে না | কনফিগ UI + স্ট্যাটাস/এরর দৃশ্যমান নয়; মালিক নিজের সার্ভার (URL) চান | N2 — নেটিভ MCP ম্যানেজার, টুল-লিস্ট, এপ্রুভাল, হেলথ-চেক |
| ১০ | UI অসুন্দর | — | N0 — Material-3 লুক arena-র নিজের রঙে + N4 পলিশ |

**গুরুত্বপূর্ণ প্রমাণ (লাইভ প্রোব, run 38641243136):** অ্যাপের সম্পূর্ণ চুক্তি আসল সাইটে নিখুঁত — ইঞ্জিন বুট, স্ক্যানার, composer-driving, actionable সেন্ড, এক আসল ক্লিক; arena নিজস্ব anonymous সেশনে ToU-consent গেট দেখায়। মালিক সাইন-ইন করা — সুতরাং পাঠানোর পথ তাঁর ডিভাইসে খোলা। ভাঙার জায়গা মূলত **উপস্থাপন-স্তর ও পার্সিং-সহনশীলতা** — প্রথমটি মূল arena পেজে injected CSS/JS স্কিনে, দ্বিতীয়টি N1-এর parser/step-card pipeline-এ ঠিক হবে; চ্যাট পেজকে Compose দিয়ে পুনর্লিখন করা হবে না।

---

### ফাইল-আপলোড গবেষণা (২০২৬-১০-১৬)

- [Arena Help Center — file uploads](https://help.arena.ai/articles/5595418316-arena-how-to-file-upload) বর্তমানে Battle Mode-এর জন্য PNG/JPEG/WebP/PDF এবং Agent Mode-এর জন্য এগুলোর পাশাপাশি GIF/TXT/MD/CSV/HTML/XML/CSS/JS/JSON তালিকাভুক্ত করে।
- [Arena Help Center — Agent Mode](https://help.arena.ai/articles/5432423882-how-to-use-agent-mode) একই allowlist প্রকাশ করে এবং বলে file support ভবিষ্যতে বাড়বে। Help page Direct ও Side-by-Side-এর জন্য পূর্ণ type matrix দেয় না; বাস্তব device/live page-এ তাদের matrix আলাদাভাবে মাপতে হবে।
- [FastChat issue #3888](https://github.com/lm-sys/FastChat/issues/3888) রিপোর্ট করে Agent Mode-এও `.py` প্রত্যাখ্যাত হয়, যদিও `text/plain` ও নির্দিষ্ট web/text MIME types accepted list-এ আছে। তাই শুধু picker filter বা input-এর `accept` পাল্টে arbitrary binary upload নিশ্চিত করা যায় না; server validation আলাদা বাধা।
- এই repo-র `MainActivity.kt` generic document picker-এ `*/*` ব্যবহার করে এবং extension list-কে Android MIME filter বানায় না (কারণ provider code files-কে `application/octet-stream` বলতে পারে)। `WebViewBridge.kt` already has a broad source/text extension list, bounded file/blob reads and chunked delivery; `sd-native.js` has a narrow text-MIME-to-`.txt` fallback. এগুলো reusable plumbing, কিন্তু Arena mode/server-এর upload contract-কে replace করে না।

**Design decision:** “যেকোনো file-কে upload হয়ে গেছে” বলে fake করা যাবে না। Arena যে ফাইল native attachment হিসেবে গ্রহণ করে, সেটি তার আসল upload path-এই যাবে। Mode-এ rejected কিন্তু text পড়া যায় এমন ফাইলের জন্য app user-visible, filename/type-সহ inline-context card বানাবে; Office-format extraction প্রথমে নিরাপদ, size-bounded text extraction হিসেবেই হবে, original binary attachment হিসেবে নয়। Unsupported/non-text binary-র জন্য কারণ ও বিকল্প (Direct/Agent-এ switch, export/convert, বা cancel) স্পষ্ট দেখাতে হবে।

## ১. টার্গেট আর্কিটেকচার

```
┌──────────────────────────────────────────────────────────┐
│ ArenaPilot — Android shell + non-chat native surfaces    │
│                                                          │
│ Native support screens (as implemented in later phases): │
│ Linux Studio · MCP manager · export · settings · doctor  │
│                                                          │
│ AgentCore (Kotlin): plan state, tool loop, pause/redirect│
│ background progress + notifications                     │
└─────────┬────────────────────────────────────────────────┘
          │ JS bridge (existing scanner + setComposer)
          ▼
┌──────────────────────────────────────────────────────────┐
│ THE ONLY CHAT SURFACE: the real arena.ai page in WebView │
│ always visible · original sign-in/CAPTCHA · original     │
│ model picker/composer/messages/reasoning                 │
│ injected Arena-colour mobile skin · DOM step cards       │
└──────────────────────────────────────────────────────────┘
          │
          ▼
   On-device Linux Computer (existing proot Alpine):
   terminal · files · pip/network · preview; AgentCore calls
   it as a tool; output streams into the page's step cards or
   the optional live Computer view. No parallel chat UI.
```

**নীতিগত সীমা (অপরিবর্তিত):** লগইন/ক্যাপচা বাইপাস নয় — সেশনটা একটা **আসল arena.ai পেজ**; recaptcha-টোকেন পেজের ভেতরেই তৈরি হয়। সাইন-ইন-সহ চ্যাটের পুরো অভিজ্ঞতা পেজের ভেতরেই — পেজটাই সবসময় দৃশ্যমান একমাত্র chat surface (নেটিভ-স্কিনে)। Native Android/Compose UI থাকলেও তা কেবল non-chat support screen; চ্যাটের parallel copy, second composer, বা replacement model picker বানানো যাবে না.

**যা বর্তমান কোডবেস থেকে টিকে থাকবে:** ইঞ্জিন বান্ডেল (স্ক্যানার, composer-ড্রাইভিং, ব্রিজ), proot স্যান্ডবক্স রানটাইম+CI, লাইভ প্রোব, হার্নেস/টেস্ট-অবকাঠামো, রিলিজ চ্যানেল। **যা নতুন করে লেখা হবে:** ইনজেক্ট করা Material-3 স্কিন (arena-র নিজের রঙে), এজেন্ট অর্কেস্ট্রেশন (Kotlin), পার্সিং-নরমালাইজার, DOM-ধাপ-কার্ড।

---

## ২. ফেজ N0 — অফিসিয়াল ইন্টারফেস, নেটিভ স্টাইলে (মূল ভিত্তি)

> **মালিকের সিদ্ধান্ত (২০২৬-১০-১৫, দুই দফা প্রশ্নোত্তরে চূড়ান্ত):**
> ১. লুকানো পেজের উপর আলাদা Compose-শেল (`a926d31`…`8ddc82c`) — **অকার্যকর ও
> অপ্রয়োজনীয়**; মুছে ফেলা হয়েছে। **arena-র অফিসিয়াল ইন্টারফেসকেই** নেটিভ-সুন্দর করতে হবে।
> ২. পদ্ধতি: আসল পেজের উপরে **গভীর স্কিন ইনজেকশন** (CSS/JS) — সম্পূর্ণ Material-3
> অ্যান্ড্রয়েড লুক-অনুভূতি; পেজ আসল পেজই থাকে (লগইন, recaptcha, ইঞ্জিন অক্ষুণ্ণ)।
> ৩. **রঙ: arena-র নিজের থিমই থাকবে** — নতুন প্যালেট চাপানো নয়; লেআউট/স্পেসিং/
> মোবাইল-উপযোগীতা সুন্দর করা।
> ৪. স্কোপ: **সব পেজ** — চ্যাট, সাইডবার, মডেল-মেনু, সেটিংস, লগইন।
> ৫. চেহারা+ফাংশন-ফিক্স **একসাথে**, প্রতি ধাপে।
> ৬. লগইন/সাইন-ইন **পেজের ভেতরেই** — আর কোনো লুকানো-মোড/টগল নেই।

**লক্ষ্য:** সম্পূর্ণ কথোপকথন — চ্যাট, মডেল বদল, ফাইল, থিংকিং — arena-র **অফিসিয়াল
ইন্টারফেসেই**, ইনজেক্ট করা মোবাইল-ফার্স্ট Material-3 স্কিন দিয়ে অ্যান্ড্রয়েড-নেটিভ
লুক ও অনুভূতিতে; পেজ আসল পেজই থাকে।

কাজ (নতুন দিকনির্দেশনা অনুযায়ী):
1. **arena-native স্কিন (CSS/JS, ইঞ্জিন-অ্যাসেট হিসেবে ইনজেক্ট)**: মোবাইল-ফার্স্ট
   Material-3 লেআউট — স্পেসিং, টাইপোগ্রাফি, রাউন্ডেড কম্পোজার, নেটিভ-ফিল স্ক্রল,
   টাচ-টার্গেট; **arena-র নিজের রঙে**। যাচাই: harness-ফিক্সচার + CI স্ক্রিনশট।
2. **মডেল-মেনু**: arena-র নিজের মেনুই (composer-এর model বাটন), মোবাইল-স্ক্রিনে
   ঠিকমতো সাজানো — লম্বা মডেল-নামে সেন্ড-বাটন/মেনু ভাঙবে না।
3. **সাইডবার**: arena-র নিজের সাইডবার **মোবাইল ড্রয়ার/হ্যামবার্গার** হিসেবে।
4. **থিংকিং**: arena নিজে যেমন আলাদা করে দেখায়, সেটাকেই মোবাইলে সুন্দর-স্টাইল
   (আলাদা ইনজেক্টেড থিংকিং-কার্ড সিস্টেম নয়)।
5. **কম্পোজার + অ্যাটাচ**: সেন্ড-বাটন সবসময় দৃশ্যমান; ছবি→arena-র ইনপুট,
   টেক্সট-ফাইল/ফোল্ডার/লিংক→ইনলাইন ডেলিভারি-কার্ড।
6. **ট্যাগ-নরমালাইজার** (N1-এর সাথে মিলিয়ে): raw ট্যাগ কখনোই স্ক্রিনে নয়।

### N0 বাস্তবায়ন-স্থিতি (২০২৬-১০-১৬; native-preservation follow-up)

- [x] চ্যাটের একমাত্র surface হিসেবে আসল arena.ai পেজ রাখা; parallel Compose chat shell যোগ করা হয়নি।
- [x] Arena-only skin hook; DeepSeek/অজানা host-এ Arena skin সক্রিয় নয়।
- [x] `our-skin.css` থেকে Arena-র native composer, textarea, Send, model/mode controls, Plus ও message typography-র width/height/flex/font/border override সরানো হয়েছে।
- [x] ইঞ্জিনের parent-flex rule Arena-র native Plus/model/mode group-এ প্রয়োগ না হওয়ার জন্য injected mount-এ preserve marker; অন্য host-এর আচরণ আলাদা থাকে।
- [x] মূল Arena Plus দৃশ্যমান থাকে; injected attachment target native Plus-এর মাপা slot-এ overlay হয়। Run #201-এর API-34 CDP log-এ 320 CSS px viewport-এ Plus `[25,551,32,32]`, Send `[263,551,32,32]`, real-pointer-click-এর পর attachment sheet open এবং `pageErrors=0` রেকর্ড হয়েছে। এটি ওই CI WebView-এর মাপ, unmodified-browser baseline-এর সঙ্গে side-by-side diff নয়।
- [x] Settings adapter আসল, open, site-owned sidebar শনাক্ত হলে তার “New Chat” row-এর geometry/style mirror করার চেষ্টা করে; sidebar-এর width/height/position লিখে না। কোনো নিশ্চিত sidebar না থাকলে engine-owned Settings entry hidden থাকে, composer-এ fallback করে না। এই আচরণ fixture/test-এ কভার করা আছে; authenticated live-site acceptance এখনও pending।
- [x] [Run #201](https://github.com/themuhammad-personal/Arenapilot/actions/runs/38851951620) (২০২৬-১০-১৬; branch `n0/arena-main-page-skin`, head `0de0e7905ba4b79dbc6889aa7e1bb97bba02fc4d`) — Build & Verify APK, Lint, Arena adapter integration, Engine harness এবং Emulator smoke (API 34) সফল। PR context-এ `Publish ArenaPilot Release` skipped ছিল; এটি failure নয়।
- [ ] মালিকের বাস্তব Android ফোনে সর্বশেষ merged build যাচাই—সাইন-ইন, account menu/Settings, sidebar open/close, model/mode picker, Thinking, attachment sheet এবং Send state।
- [ ] authenticated session-এ Arena sidebar, composer/textarea, Plus, model/mode ও Send-এর screenshot + computed-style/DOM geometry সংগ্রহ; একই viewport-এ unmodified Arena baseline-এর সঙ্গে তুলনা। Run #201 CDP report-এ `loginWall=yes` এবং Health status-এ `sidebar:missing`; তাই CI-র Settings-anchor measurement-কে authenticated sidebar acceptance ধরা যাবে না।
- [ ] মালিকের বাস্তব ফোনের evidence অনুযায়ী সূক্ষ্ম spacing/state polish; Arena-owned control-এ অনুমানভিত্তিক width/height/font/radius/padding/flex/transform যোগ করা যাবে না।

**অবস্থা: CI green, N0 এখনও সম্পূর্ণ নয়।** Run #201-এর CDP-তে `pageErrors=0`, native Plus থেকে attachment sheet open এবং 320px viewport-এ Send reachable থাকার প্রমাণ আছে। কিন্তু ওই session-এ `loginWall=yes`; authenticated Settings/sidebar open-close acceptance এবং real-device screenshot/geometry diff এখনও বাকি। বাস্তব ফোনে যাচাই ও প্রমাণ না পাওয়া পর্যন্ত N0 complete বলা যাবে না।

### N0 follow-up — Settings card clipping and icon

- [x] সাইডবারের অনিয়মিত Settings shortcut সরিয়ে বিদ্যমান `+ / Add to chat` tool list-এর একেবারে শেষে Settings card রাখা হয়েছে; card tap করলে একই Settings drawer খোলে এবং শিট আগে বন্ধ হয়।
- [x] ছোট viewport-এ tool-list container-এর বাস্তব available height মেপে scroll area করা হয়েছে; `overflow-y:auto` দিয়ে তালিকা নিজে scroll করে, আর row-গুলোর `flex-shrink:0` থাকার কারণে শেষ card আর সংকুচিত/কাটা পড়ে না। header ও Camera/Photos/Files quick actions অক্ষত থাকে।
- [x] Gear icon standard outline path ও 18×18 viewBox-size-এ আপডেট; fixture test-এ center ring, outline ও Settings-এর সম্পূর্ণ দৃশ্যমানতা এবং scroll করে শেষ card-এ পৌঁছানো যাচাই করা হয়েছে।
- [x] [Settings-card CI run](https://github.com/themuhammad-personal/Arenapilot/actions/runs/38889266715) সফল; authenticated বাস্তব ফোনে পুনরায় পরীক্ষা এখনও দরকার।

**N0 অবস্থা:** code/CI check সম্পন্ন, কিন্তু signed-in ফোনে Settings card পুরো দেখা ও খোলা এবং model/mode, Thinking, attachment ও Send পরীক্ষা না হওয়া পর্যন্ত N0 সম্পূর্ণ নয়।

## ৩. ফেজ N1 — এজেন্ট কোর (কম্পিউটার + ধাপ-কার্ড)

1. **প্ল্যান-কার্ড**: টাস্ক দিলে মডেলের to-do প্ল্যান নেটিভ চেকলিস্টে (Manus-স্টাইল), স্টেপ সম্পন্ন হলে টিক।
2. **ধাপ-কার্ড** (মালিক-নিশ্চিত: পেজের DOM-এ ইনজেক্ট করা নেটিভ-স্টাইল কার্ড): প্রতিটি টুল-কল — কমান্ড+লাইভ আউটপুট, ফাইল তৈরি→প্রিভিউ, fetch→সোর্স-লিংক; সফল/ব্যর্থতা স্পষ্ট, ব্যর্থ হলে এক-ট্যাপ রিট্রাই।
3. **লাইভ Computer ভিউ**: টার্মিনাল + ফাইল-ট্রি + প্রিভিউ (বিদ্যমান Linux Studio এজেন্ট-প্যানেলে উন্নীত), মাঝপথে **পজ/রিডাইরেক্ট**।
4. **নেটিভ Visualizer**: স্যান্ডবক্সড WebView কার্ড, ফুল-স্ক্রিন, শেয়ার।
5. **ট্যাগ-নরমালাইজার**: কোড-ফেন্স, আংশিক/বিভক্ত ট্যাগ, মডেল-ভিন্ন কোট (backtick মুক্ত) — পার্সিং-সহনশীলতা + ইউনিট-টেস্ট কর্পাস (প্রতি মডেলের আসল আউটপুট নমুনা)।
6. **ডক্টর স্ক্রিন**: সেশন-স্বাস্থ্য, স্ক্যানার-সারি, শেষ পার্স-এরর, মডেল-সাপোর্ট ম্যাপ — মালিকের স্ক্রিনশটেই রিমোট-ডিবাগ।
7. **মডেল রিলায়েবিলিটি ম্যাপ**: কোন মডেল টুল-প্রোটোকল মানে — ব্যাজ+সুপারিশ ("Agentic ✅")।

8. **Mode-aware file attachments (সব chat mode):**
   - [ ] Battle, Side-by-Side, Direct, Agent এবং উপলব্ধ Auto/Text/Image variant-এ live capability matrix সংগ্রহ: mode selector, native `input[type=file].accept`, MIME/extension, client rejection ও submit-এর পর server response। শুধু picker খোলা বা file pill দেখা success নয়; প্রতিটি type-এর final attach/submit outcome নথিভুক্ত।
   - [ ] Capability table থেকে routing: (a) mode+server যে MIME/type নিশ্চিতভাবে নেয় → Arena native attachment, (b) পড়া যায় এমন text/code (যেমন .py/.ts/.yaml/.log/.sql) কিন্তু native allowlist-এ নেই → একই পাঠানোর আগে review করা যায় এমন inline-context card, filename + detected type + bounded content সহ, (c) DOCX/XLSX/PPTX/RTF-এর মতো supported document container → on-device/sandbox-এ সীমিত text/table extraction করে inline context; স্পষ্টভাবে “extracted text”, native upload নয়।
   - [ ] Battle/Side-by-Side-এ দুই পাশকে একই exact inline context দিতে হবে—এক পাশের hidden attachment/অসম context চলবে না। Existing user text-এর সঙ্গে visible delimiter-এ ফাইলের নাম, format ও start/end marker রাখতে হবে; user preview/edit/remove করতে পারবে, submit-এর আগে consent/confirmation স্পষ্ট থাকবে।
   - [ ] Archive/container support opt-in ও নিরাপদ: archive-bomb guard, entry-count/depth/uncompressed-size/time limits, path traversal block, binary skip; default-এ ZIP-এর সব content auto-inject নয়। প্রথম release-এ opaque binary (APK/EXE/audio/video/unknown) parse বা ভুয়া .txt rename করবে না।
   - [ ] সব mode-এ multi-file, cancel, picker MIME ভুল/ `application/octet-stream`, UTF-8 fallback, empty/unreadable/oversize, truncation notice, duplicate name, malicious archive ও screen rotation tests। Size/context budget per-mode সীমিত, content silently truncate হবে না; truncation হলে user-visible notice এবং preview থাকবে।
   - [ ] Native PDF/image behavior regress না করা; mode switch, back/restore, resend এবং prompt history-তে attachments/context স্থায়ীভাবে ও নির্ভুলভাবে দেখানো; telemetry-তে filename/content পাঠানো নয়। Unsupported type হলে honest error + supported alternative।

**গ্রহণযোগ্যতা (file uploads):** type×mode test matrix-এ native upload সফল যেখানে server সমর্থন করে; unsupported text/code/document-এর ক্ষেত্রে user-visible inline content দুটো battle response-এ একইভাবে পৌঁছায়; original PDF/image path অক্ষত; unsupported binary কখনো silent “success” দেখায় না। Authenticated live Arena smoke test-এ evidence সংরক্ষণ করতে হবে, UI fixture একা যথেষ্ট নয়।


**গ্রহণযোগ্যতা:** আসল সাইটে এন্ড-টু-এন্ড এজেন্ট টাস্ক — প্ল্যান → স্যান্ডবক্সে কোড রান → ফাইল আউটপুট → প্রিভিউ; লাইভ প্রোব-প্রমাণ।

## ৪. ফেজ N2 — MCP ও নির্ভরযোগ্যতা

1. **MCP ম্যানেজার (নেটিভ)**: URL/JSON দিয়ে সার্ভার যোগ, টুল-লিস্ট, হেলথ-চেক, প্রতি-টুল এপ্রুভাল, কল-হিস্ট্রি কার্ড।
2. **এরর-সারফেস**: মাঝপথের এরর নেটিভ বার্তা+রিট্রাই; স্ট্রিম বিচ্ছিন্ন হলে অবস্থা-সংরক্ষণ।
3. **মালিকের নিজের সার্ভার** দিয়ে লাইভ ভেরিফিকেশন (তাঁর URL-এ কানেক্ট → টুল-কল প্রমাণ)।

## ৫. ফেজ N3 — Manus-প্যারিটি UX

1. **ফোরগ্রাউন্ড সার্ভিস + নোটিফিকেশন**: অ্যাপ মিনিমাইজ করলেও এজেন্ট চলে; প্রগ্রেস+সমাপ্তি নোটিফিকেশন।
2. **ডেলিভারেবল এক্সপোর্ট সেন্টার**: স্যান্ডবক্স-ফাইল → সেভ/শেয়ার (zip), রিপোর্ট→PDF, চার্ট→ইমেজ, সাইট→প্রিভিউ+zip।
3. **শিডিউল্ড টাস্ক**, হোম-উইজেট, **@-রেফারেন্স** (পুরনো টাস্কের কনটেক্সট), স্ল্যাশ-কমান্ড (নেটিভ)।
4. **মেমোরি/পারসোনা/প্রজেক্ট** — নেটিভ স্ক্রিনে (ইঞ্জিনে ইতিমধ্যে আছে)।

## ৬. ফেজ N4 — পলিশ ও হার্ডেনিং

Material 3 ডায়নামিক থিম, অনবোর্ডিং, **বাংলা UI অপশন**, অ্যাক্সেসিবিলিটি, হেলথ-মনিটরের নেটিভ সারফেস ("arena.ai বদলেছে — X সাময়িক বন্ধ"), পারফরম্যান্স (কম-মেমোরি ডিভাইস), রিলিজ-নোট ও আপডেট-চ্যানেল মসৃণকরণ।

---

## ৭. ঝুঁকি ও সৎ সীমা

1. **arena.ai DOM বদলালে ভাঙতে পারে** — স্ক্যানার চুক্তি কেন্দ্রীভূত (এক জায়গায়), হেলথ-মনিটর + দ্রুত প্যাচ; লাইভ প্রোব প্রতি রিলিজে ধরবে।
2. **মডেল-ভেদে আচরণ** — আমরা নরমালাইজ করি, কিন্তু প্রতিটি মডেলের গ্যারান্টি arena-র হাতে; রিলায়েবিলিটি ব্যাজ সৎ উত্তর।
3. **অন-ডিভাইস কম্পিউটার** = বিনামূল্যে+প্রাইভেট, কিন্তু ক্লাউড VM-এর চেয়ে ধীর/সীমিত (ব্রাউজার-এজেন্ট নয়) — এটাই আমাদের প্রতিযোগিতামূলক পজিশন।
4. **সাইন-ইন/recaptcha পেজের ভেতরেই** — নীতি অপরিবর্তিত; লুকানো সেশনে প্রয়োজনে দৃশ্যমান ধাপ।
5. **ফোরগ্রাউন্ড সার্ভিস** — Android-এর সীমায় (ব্যাটারি/ব্যাকগ্রাউন্ড-কিল) নোটিফিকেশন-সহ চলবে; অ্যান্ড্রয়েড ৮+ টার্গেট।

## ৮. ডেলিভারি ধারা ও যাচাই

- প্রতি ফেজ = এক রিলিজ (`arena-latest` চ্যানেল, `arenapilot-latest.apk`, প্যাকেজ অপরিবর্তিত → আপডেট বসে)।
- প্রতি পুশ: ৩৮২+ ইউনিট টেস্ট, হার্নেস, এমুলেটর-স্মোক, লাইভ প্রোব (marker-gated)।
- প্রতি ফেজের শেষে: মালিকের ডিভাইসে গ্রহণযোগ্যতা-তালিকা যাচাই + ডক্টর-স্ক্রিন স্ক্রিনশট প্রমাণ।

**ক্রম:** N0 → N1 → N2 → N3 → N4। প্রতিটি ফেজ শেষে ব্যবহারযোগ্য APK; মালিক চাইলে ফেজ-মধ্যে পরীক্ষা-বিল্ড।
