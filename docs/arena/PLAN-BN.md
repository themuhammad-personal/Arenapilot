> **বর্তমান কাজ:** ২০২৬-১০-১৪ থেকে [কার্যকারিতা পুনর্গঠনের রোডম্যাপ](ROADMAP-2-BN.md) অনুসরণ করুন। এই নথির শেষের সম্পন্ন/স্থগিত সিদ্ধান্তগুলি আগের port-এর ঐতিহাসিক অবস্থা।

# Super DeepSeek ইঞ্জিন → arena.ai পোর্ট: সম্পূর্ণ পরিকল্পনা

তারিখ: ১১ অক্টোবর ২০২৬ · শাখা: `arena/43c0caca-super-deepseek` · অবস্থা: **ফেজ-১ ✅ · ফেজ-২ ✅ · ফেজ-৩ ✅ (শেষ /chat/s/ সাইটগুলোও সম্পন্ন) · ফেজ-৪ ✅ দুই হার্ড শর্ত + Arena Deck-এর আইকন ও বিজ্ঞপ্তি সম্পন্ন · ফেজ-৫ ✅ (বাকি আইটেম প্রমাণে নিষ্পত্তি, §২২-চ) · ফেজ-৬ 🟡 নিরাপত্তা-অডিট ও CI-যাচাই সম্পন্ন · **ফেজ-০ আংশিক: আসল arena.ai-র অ্যানোনিমাস পেজ CI এমুলেটর থেকে পড়া হয়েছে (§২৩)** — বাকি: লগ-ইন-করা অবস্থা ও কথোপকথনের ক্যাপচার (টেস্ট ৩২৬/৩২৬, §২২-ছ)**

এই ডকুমেন্টটা পুরো রিপোটি ফাইল-দর-ফাইল পড়ে তৈরি করা হয়েছে — Kotlin শেল (২১টি ফাইল),
ইঞ্জিন বান্ডেল (৭টি JS + ২টি CSS), টেস্ট (২৮ JVM ইউনিট + ২ androidTest + ৮ node),
হারনেস, স্ক্রিপ্ট, CI ও ডকস।
প্রতিটি দাবির পাশে প্রমাণ (ফাইল:লাইন / বাইট-অফসেট / মাপা সংখ্যা) দেওয়া আছে।

---

## ০. এক কথায় উত্তর

**হ্যাঁ, ইঞ্জিনটা arena.ai-তে ইনজেক্ট করা যাবে** — কিন্তু সেটা "সেটিংস বদলানো" নয়, সেটা একটা
**সাইট-অ্যাডাপ্টার পোর্ট**। কারণ ইঞ্জিনের *নিজস্ব* সব UI (অ্যাডভান্সড সেটিংস ড্রয়ার, প্লাস-শিট,
কমান্ড পপআপ, মেমরি/প্রম্পট/প্রজেক্ট/MCP/Deep Research/Linux & Agent পেজ) সম্পূর্ণ
engine-owned DOM ও CSS — ওগুলো arena.ai-তেও হুবহু একই থাকবে। যা বদলাতে হবে সেটা হলো
**ইঞ্জিন যেসব জায়গায় DeepSeek-এর পেজ ও API-র ওপর দাঁড়িয়ে আছে সেই "নোঙর" (anchor) গুলো**।

আপনার শর্ত দুটো এই পোর্টে **হার্ড রিকোয়ারমেন্ট** হিসেবে ধরা হয়েছে (§৫):

1. সাইডবারের লগইন/অ্যাকাউন্ট মেনুর **অ্যাডভান্সড সেটিংস** এন্ট্রি — যেখানে আছে, যেভাবে আছে,
   ভেতরের সব সেটিংস ও UI ডিজাইন সহ অক্ষুণ্ণ।
2. **প্লাস (+) আইকনে ট্যাপ করলে যে শিট ওঠে** — একই কার্ড-সেট, একই ডিজাইন, একই আচরণ।

আর "ডিপ রিসার্চ / লিনাক্স স্যান্ডবক্সের মতো হাই-ফিচার" সম্পর্কে সত্যিটা হলো: **ওগুলোও বেশিরভাগ
অক্ষুণ্ণ রাখা সম্ভব** (§৬), কারণ ওদের লজিক সাইট-নিরপেক্ষ (bridge fetch + প্রম্পট + engine UI)।
সত্যিকারে অচল হবে শুধু সেই ফিচারগুলো যেগুলো DeepSeek-এর *নিজস্ব* সার্ভিস/ডিজাইনের ওপর বসে
(টোকেন-প্রাইস ব্যাজ, স্ট্যাটাস মনিটর, ব্যালান্স, API প্লেগ্রাউন্ড, DeepSeek Harness)।

> ⚠️ **একমাত্র ব্লকার:** এই স্যান্ডবক্স থেকে `arena.ai`-তে যাওয়া যায় না (আউটবাউন্ড হোস্ট
> হোয়াইটলিস্টে শুধু github/npm/pypi)। তাই ফেজ-০ (রিয়েল পেজ ক্যাপচার) ছাড়া বাকি কোনো ফেজ
> *নির্ভরযোগ্যভাবে* শুরু করা যাবে না। বিস্তারিত §৯।

---

## ১. এখনকার অবস্থা: ইঞ্জিন কোথায় কোথায় DeepSeek-এর ওপর দাঁড়িয়ে আছে

### ১.১ ইঞ্জিন আসলে কী

| ফাইল | আকার | প্রকৃতি |
|---|---|---|
| `bds-assets/bds/content.js` | ৩,৩২৬,৬৩১ বাইট / ৩৬৫৬ লাইন (সর্বোচ্চ লাইন ৬৪৩,১৬৭ অক্ষর) | মিনিফাইড Svelte বিল্ড + শেষে ~৩২০০–৩৪২০ লাইনে এই প্রজেক্টের হাতে-লেখা প্যাচ (`sdBuildOverview`, `sdRow`, `sdT` …) |
| `bds-assets/bds/injected.js` | ৬০,১৬২ বাইট | মিনিফাইড নেটওয়ার্ক লেয়ার (fetch/XHR হুক, প্রম্পট ইনজেকশন) |
| `bds-assets/bds/sandbox.js` | ১,২১৯,৯৭৯ বাইট | আইসোলেটেড কোড রানার (Pyodide ইত্যাদি) |
| `sd-native.js` / `sd-agent.js` / `sd-sheets.js` / `sd-health.js` | ৮৬২ / ১৪৫০ / ৩৮৬ / ২৬৮ লাইন | হাতে-লেখা, পড়া যায়, কমেন্টসহ |
| `content.css` | ১১০,৩৯০ বাইট | **৫০৮টি ইউনিক `.bds-*` ক্লাস** (engine-owned) বনাম মাত্র ৪টি `.ds-*` + ২টি হ্যাশড ক্লাস (সাইট-শেপিং) |
| `our-skin.css` | ৪৪ লাইন | রিটায়ার্ড (খালি) + bidi রুল; bidi রুলে `.ds-markdown` সেলেক্টর আছে |

রিপো-র নিয়ম (`docs/MASTER-PROMPT.md` হার্ড রুল ৪): `content.js` **কখনোই আপস্ট্রিম থেকে রিবিল্ড
বা রিপ্লেস করা যাবে না**; এডিট শুধু *অ্যাসার্টেড সিঙ্গল-ম্যাচ স্ট্রিং রিপ্লেসমেন্ট* দিয়ে, এবং পরে
`node --check` + `npm run test:engine`। এই পরিকল্পনা সেই নিয়ম মেনেই লেখা।

### ১.২ ইনজেকশন চেইন (Kotlin)

`MainActivity.injectBdsScripts()` (লাইন ৮৩১) → `ENGINE_CLAIM_JS` (লাইন ৮৭৮, এক ডকুমেন্টে একবার)
→ ক্রম: `injected.js` → `style#bds-css` (content.css + our-skin.css) → `content.js` →
(`sd-native.js` + `sd-agent.js` + `sd-sheets.js` + `sd-health.js`) → `UiPolish.buildScript()`।
গেট: `MainFrameTracker.shouldInjectEngine()` → `isTrustedBridgeUrl()` = **শুধু
`https://chat.deepseek.com`** (`ChatUrls.kt:7`)।

### ১.৩ মাপা কাপলিং (grep দিয়ে গুনে)

| কী | সংখ্যা | কোথায় |
|---|---|---|
| `deepseek` শব্দ | content.js-এ ৫৪৯ · injected.js-এ ৪০ · sd-agent.js-এ ৪ · sd-health.js-এ ৬ · sd-native.js-এ ২ · sd-sheets.js-এ ১ | — |
| ইউনিক `.ds-*` ক্লাস | **৫২** | content.js |
| ইউনিক হ্যাশড `_[0-9a-f]{7}` ক্লাস | **৩০** | content.js |
| ইউনিক খালি হ্যাশ `[0-9a-f]{8}` ক্লাস | ৪ | content.js |
| `chat.deepseek.com` লিটারেল | ৬ | content.js |
| `/api/v0/...` পাথ | ৩ (`chat/completion`, `chat/edit_message`, `chat_session/fetch_page`) + injected.js-এ `chat/history_messages` | content.js, injected.js |

### ১.৪ কেন্দ্রীয় কনফিগ অবজেক্ট `PH` — সবচেয়ে গুরুত্বপূর্ণ আবিষ্কার

content.js @৫৬,২১৮-এ একটা কনফিগ অবজেক্ট আছে (`PH={features:{apiPlayground:...`) যার ভেতরে
**পুরো সাইট-কাপলিং এক জায়গায়**:

```
features:      apiPlayground, attachMenu(expert/instant/deepthink/vision), fileUpload,
               codeBlocks, sidebar(tagsButton/search/exportButton/tagHider),
               systemPromptInjection, voice, tokenPriceDisplay, export, longWork, rag,
               characterRp, autoFetch, expandToggle, questionPanel, codeRunner, tagManager,
               sideBarMenuInjector, selectionMode, whatsNewPopup, statusMonitor, themeWatcher
selectors:     message{container:"div.ds-message._63c77b1", userRole:["d29f3d7d","_9663006"],
                        assistantRole:["_4f9bf79._43c05b5"]},
               modelBadge:"._46a12ab", modelSwitcher:'[role="radiogroup"]',
               fileInput:'input[type="file"][multiple]',
               chatInput{textarea:["#chat-input",...], wrapper:["._75e1990","._6f68655",...,".ds-textarea"]},
               sidebar{chatLink:'a[href*="/chat/s/"]', titleElement:".c08e6e93",
                       panel:".dc04ec1d", menuButton:"._2090548", dateGroup:"div._3098d02"},
               header{title:"._7436101", logoContainer:"._262baab", logoViewBox:'svg[viewBox="0 0 143 23"]'},
               dropdownMenu{container:".ds-dropdown-menu", option:".ds-dropdown-menu-option",
                            optionLabel:".ds-dropdown-menu-option__label"},
               priceInsertion{...}, sendButton{selectors, svgPaths:["M8.3125",...],
                            disabledClass:"ds-icon-button--disabled"},
               stopButton{selectors:[".ds-icon-stop-circle",".ds-icon-stop", svg path…]},
               textExtraction{thinkContent:".ds-think-content", noiseClasses:[...]},
               codeBlock{container:".md-code-block", atomButton:".ds-atom-button"},
               previewPanel:"._519be07", renameInput:"input.ds-input__input",
               theme{darkClass:"dark", lightClass:"light"}
modelDetection / modelMappings / api{chatCompletionPaths, sessionFetchPath, statusUrl, pricing}
urlPatterns{chatSession:"/chat/s/", base:"https://chat.deepseek.com/"}
android{hideGetAppText, hideDrawerAppItemText} / remoteConfig / embeddedPricing / modelInputLimits
```

**কিন্তু একটা ফাঁদ আছে:** কনফিগ সার্ভিস `Ki` (ক্লাস `$lt`, @২,৪১৮,৫৯১) `raw` গেটারে
`PH` + রিমোট ওভাররাইড (স্টোরেজ কি `bds_remote_config`) মার্জ করে, অথচ পুরো বান্ডলে
`Ki.getConfig(...)` কল হয় **মাত্র ১০ জায়গায়** (chatInput textarea/wrapper, sendButton ×৩,
stopButton, modelBadge, modelSwitcher, api.statusUrl)। বাকি সব কোড **সরাসরি `PH` অবজেক্ট পড়ে**।
আর `applyRemote()` `PH`-কে মিউটেট করে না — নতুন অবজেক্ট বানায়।

➡️ **সিদ্ধান্ত:** রানটাইম রিমোট-কনফিগ পুশ করে ইঞ্জিনকে রি-টার্গেট করা **যাবে না**।
`PH`-তেই একটা seam বসাতে হবে (§৭.১) — সৌভাগ্যক্রমে সেটা মাত্র ২টি ইউনিক স্ট্রিং রিপ্লেসমেন্ট।

### ১.৫ কনফিগের বাইরে হার্ডকোড থাকা জায়গা (প্যাচ করতেই হবে)

| কী | anchor স্ট্রিং | ম্যাচ সংখ্যা | কাজ |
|---|---|---|---|
| সেটিংস-মেনু ইনজেক্টর | `function WQ(e){var a;` | ১ | DeepSeek-এর `.ds-dropdown-menu`-তে "Settings" অপশনের পরে `bds-advanced-settings-option` বসায় → `bds:open-drawer` ডিসপ্যাচ |
| মেনু-আইটেম বিল্ডার | `ds-dropdown-menu-option ds-dropdown-menu-option--none` | ১ | `rw()` — DeepSeek-এর ড্রপডাউন DOM হুবহু কপি করে |
| সাইডবার রিনেম (ট্যাগ) | `_2090548` | ২ | কনফিগ না পড়ে সরাসরি হ্যাশড ক্লাস ব্যবহার |
| সেন্ড আইকন | `.ds-icon-send` | content.js ৫ · sd-agent.js ১ | ইউজার-সেন্ড শনাক্তি |
| স্টপ আইকন | `.ds-icon-stop-circle` | content.js ৫ · sd-agent.js ৩ | জেনারেশন চলছে কি না + "ইউজার থামিয়েছে" |
| সেশন আইডি | `function eF(){...location.href.match(/\/chat\/s\/([^\/]+)/)` | ১ | URL থেকে চ্যাট আইডি |
| নিউ চ্যাট | `window.location.href="https://chat.deepseek.com/"` | ৩ | `sdNewChat()` (অফসেট ৩,০৮০,০৫০) |
| স্ট্যাটাস মনিটর | `status.deepseek.com` | ২ | DeepSeek স্ট্যাটাস উইজেট |
| ব্যালান্স | `api.deepseek.com/user/balance` | ২ | DeepSeek অ্যাকাউন্ট ব্যালান্স |
| লোগো লিংক | `svg[viewBox="0 0 143 23"]` | ২ | DeepSeek লোগোকে হোম-লিংক বানায় |
| নেটওয়ার্ক পাথ | `/api/v0/chat/completion` (২), `/api/v0/chat_session/fetch_page` (৩), `/api/v0/chat/history_messages` (৩) | injected.js | হুক ফিল্টার `y(url)` + ইভেন্ট |
| পেলোড রিরাইটার | `function I(e,t){var x,y,k;` | ১ | DeepSeek-এর বডি শেপ (`prompt:[{role,content,message_id,parent_message_id}]` অথবা লিগ্যাসি `prompt` স্ট্রিং) ধরে সিস্টেম-প্রম্পট/মেমরি/MCP বসায় |
| হিস্ট্রি শেপ | `chat_messages` (sd-agent.js ২) | — | এজেন্ট টুল-আর্গুমেন্ট হুবহু পড়ে + keep-going nudge |

### ১.৬ Kotlin সাইডের হোস্ট-গেট

| ফাইল | কী আটকে আছে |
|---|---|
| `ChatUrls.kt:7` | `isTrustedBridgeUrl` → host == `chat.deepseek.com` |
| `ChatUrls.kt:12,22-25` | `restorable()` → regex `^/a/chat/s/[A-Za-z0-9-]{1,80}/?$` |
| `MainActivity.kt:267` | `DS_HOST` (blob সার্ভ + service-worker intercept, লাইন ৫১৭/৫৬২) |
| `MainActivity.kt:101` | `shouldOpenExternally()` → deepseek.com / hcaptcha.com / Google auth in-app |
| `MainActivity.kt:749` | প্রথম লোড URL |
| `PageActions.kt:51` | `isChatDeepLink()` |
| `AndroidManifest.xml` | deep-link intent-filter host, `android:label` |
| `WebViewBridge.kt` | `trustedPage` গেট (২২টি `@JavascriptInterface` মেথড সব সাইট-নিরপেক্ষ) |
| `UiPolish.kt:53,66-69` | DeepSeek-নির্দিষ্ট sweep (Voice Mode / Deep Code row, `.bds-tip-bar`, `.bds-github-link`, `.bds-drawer-search-bar`) + লাইন ২৫৩-এ কমান্ড-ম্যানেজার রিপেয়ার (`textarea#chat-input`) |

`READY_PROBE_JS` (লাইন ৯১০) এবং `PAGE_BG_PROBE_JS` **সাইট-নিরপেক্ষ** — বদলাতে হবে না।
স্যান্ডবক্স/স্টুডিও ফাইলগুলো (`Sandbox*.kt`, `Studio*.kt`, `TarGz.kt`, `ShellProtocol.kt`)
**সম্পূর্ণ সাইট-নিরপেক্ষ**।

---

## ২. arena.ai আসলে কী (গবেষণালব্ধ তথ্য)

`arena.ai` = পুরনো **LMArena / Chatbot Arena**, ২৮ জানুয়ারি ২০২৬-এ রিব্র্যান্ড হয়ে `arena.ai`
ডোমেইনে এসেছে। ফ্রি, Next.js App Router + React + Tailwind, মোড: **Battle** (দুই অজ্ঞাত মডেল,
ভোট), **Side-by-side**, **Direct Chat** (নিজে মডেল বেছে নেওয়া) ও **Agent Mode**।

### ২.১ DOM (প্রমাণ: `dexforint/arena-utils` — arena.ai Direct chat-এর জন্য বানানো Chrome এক্সটেনশন)

| বিষয় | arena.ai |
|---|---|
| কম্পোজার | `textarea[name="message"]` (form-এর ভেতরে, React-controlled → `_valueTracker` রিসেট লাগে) |
| সেন্ড বাটন | `button[aria-label="Send message"]` |
| মেসেজ লিস্ট | `main ol.flex-col-reverse` (⚠️ **column-reverse** — স্ক্রল ম্যাথ উল্টো) |
| মেসেজ রুট | `.prose` ধারণকারী নোড; ইউজার = `justify-end` / `.self-end` / `:scope > .group` |
| কোড ব্লক | `[data-code-block="true"]` |
| মাউন্ট পয়েন্ট | `#root-portal-target` (পেজের নিজের পোর্টাল রুট — আমাদের জন্য বোনাস) |
| থিম | `document.documentElement.classList.contains('dark')` + CSS ভ্যারিয়েবল `--text-primary`, `--header-primary`, `.bg-surface-raised` |
| চ্যাট URL | `/c/{id}`; নিউ চ্যাট `/`, `/text`, `/text/direct?model_a=…`, `/agent` |
| কপি আইকন শনাক্তি | SVG path মার্কার `M19.4 20H9.6`, `M15 9V4.6` |

### ২.২ API সারফেস (প্রমাণ: `JoTalbot/orchestrator` → `arena_agent/api_map.json` ১১৬ এন্ট্রি + `api_notes.json`)

| এন্ডপয়েন্ট | কী করে |
|---|---|
| `POST /nextjs-api/stream/create-chat` ⚠️ **Agent মোডের** (§২১) | নতুন চ্যাট; বডি `{message:{id:uuid7, role:'user', parts:[{type:'text',text}\|{type:'file',url,mediaType,filename}]}, recaptchaV3Token, timezone, modelId?, harnessId?, enabledConnectors?}` → `{id}` |
| `POST /nextjs-api/stream/post-to-evaluation/{id}` | চলমান চ্যাটে পরের মেসেজ |
| `POST /nextjs-api/stream/rerun/{id}`, `resample/{id}`, `stop/{chatId}/messages/{msgId}`, `skip-direct-battle/{id}` | রি-রান / রিস্যাম্পল / স্টপ / স্কিপ |
| `GET /api/chat/{id}/messages` ⚠️ **Agent মোডের** (§২১) | `{messages[], pagination{cursor,hasMore}}` (পিছন দিকে প্যাজিনেট) |
| `GET /api/history/unified`, `/api/history/search` | চ্যাট তালিকা ও সার্চ |
| `PATCH /api/history/{text\|agentic}/{id}` | টাইটেল রিনেম |
| `GET /api/billing/balance` | `{creditsRemaining, dailyFreeCredits, refreshedAt}` (দৈনিক ফ্রি ১,০০০,০০০ ক্রেডিট) |
| `GET /api/me`, `/api/me/pulse` | প্রোফাইল / কোটা |
| Agent মোড | `POST /api/chat/trigger-token` → `publicAccessToken` (JWT); `POST /ai-proxy/realtime/v1/sessions/{id}/in/append`; `GET .../out` = SSE, ইভেন্ট `{records:[{seq_num, body:'{"data":{"type":"text-delta"\|"reasoning-delta"\|"tool-input-delta"\|"start"…}}'}]}` |
| আপলোড | `POST /api/storage/generate-agent-upload-url` → CAS hash → ফাইল URL `/api/chat/workspace/cas/user/{hash}` |

### ২.৩ দুটো জরুরি সীমাবদ্ধতা

1. **`recaptchaV3Token` বাধ্যতামূলক** (create-chat) → ইঞ্জিন কখনোই নিজে API কল করে মেসেজ
   পাঠাতে পারবে না; টোকেন পেজ মিন্ট করে। সমাধান: বর্তমান পথটাই রাখা — DOM-ড্রিভেন সেন্ড
   (`$W()` → `bCe()` সেন্ড-বাটন খুঁজে ক্লিক করে)।
2. **Direct Chat-এ এখন অ্যাকাউন্ট লাগে** (Battle ফ্রি) → অ্যাপে সাইন-ইন ফ্লো (ইমেইল ম্যাজিক লিংক +
   Google) WebView-তেই চলতে হবে; `isGoogleAuthHost()` ইতিমধ্যে Google-কে in-app রাখে।

---

## ৩. তিন স্তরে ভাগ: কী থাকবে, কী বদলাবে, কী যাবে

### স্তর ১ — অক্ষুণ্ণ (সাইট-নিরপেক্ষ, এক লাইনও বদলাবে না)

- ইঞ্জিনের **সব নিজস্ব UI**: `#bds-drawer` (অ্যাডভান্সড সেটিংস + ১২টি সাব-পেজ), `.bds-attach-dropdown`
  (প্লাস-শিট), `.bds-project-panel`, কমান্ড পপআপ/হেল্প শিট, টোস্ট, question panel — এবং
  `content.css`-এর **৫০৮টি `.bds-*` ক্লাস**।
- `sd-sheets.js` (ড্র্যাগ-টু-ডিসমিস), `sd-native.js` (কীবোর্ড/ব্লব/শেয়ার গ্লু), `UiPolish`-এর
  কমান্ড-ম্যানেজার রিপেয়ার লজিক।
- **AndroidBridge-এর ২২টি মেথড** (storage, pickers, downloads, haptics, MCP fetch, sandbox) —
  শুধু `trustedPage`-এর হোস্ট বদলাবে।
- **Linux স্যান্ডবক্স + এজেন্ট লুপ + Linux Studio + ফোরগ্রাউন্ড সার্ভিস** (পুরো `Sandbox*.kt`,
  `Studio*.kt`) — এগুলো পেজের DOM নয়, `__sdEngine` ও ব্রিজের ওপর দাঁড়িয়ে আছে।
- BootScreenView-এর মেকানিক্স, PixelCopy বার-কালার, Back হ্যান্ডলিং, NetworkGuard (SSRF),
  UpdateChecker-এর মেকানিক্স।

### স্তর ২ — অ্যাডাপ্টার দরকার (কাজের আসল অংশ)

কম্পোজার/সেন্ড/স্টপ/মেসেজ-রো/রোল সেলেক্টর · সাইডবার ও অ্যাকাউন্ট-মেনু অ্যাংকর · সেশন আইডি ·
নিউ-চ্যাট · API এন্ডপয়েন্ট ও পেলোড শেপ · SSE ফ্রেম পার্সার · হিস্ট্রি শেপ · থিম শনাক্তি ·
মডেল শনাক্তি (`?model_a=` / `button[aria-label*=", model "]`)।

### স্তর ৩ — arena-তে নিষ্ক্রিয় (প্রোফাইল ফ্ল্যাগে বন্ধ, ডেড UI রাখা হবে না)

টোকেন-প্রাইস ব্যাজ ও সেশন টোটাল (arena স্ট্রিমে `usage` নেই) · স্ট্যাটাস মনিটর
(`status.deepseek.com`) · ব্যালান্স উইজেট · **API প্লেগ্রাউন্ড** (DeepSeek API) · DeepSeek Harness
প্লাগইন · মডেল-সুইচার/ব্যাজ ডিটেকশন · সাইডবার ট্যাগ/ডেট-গ্রুপ (DeepSeek DOM-নির্ভর অংশ) ·
"Get App" / "Download mobile App" লুকানো (arena-তে এমন আইটেম নেই) · Voice/Deep Code (এখনও লুকানো)।

---

## ৪. ফিচার-ভিত্তিক ভাগ্য তালিকা

| ফিচার | arena.ai-তে | কেন |
|---|---|---|
| অ্যাডভান্সড সেটিংস ড্রয়ার + ১২ পেজ | ✅ হুবহু | engine-owned; শুধু এন্ট্রি-অ্যাংকর বদলাবে |
| প্লাস (+) শিট | ✅ হুবহু | মাউন্ট হিউরিস্টিক ইতিমধ্যে স্ট্রাকচারাল (`iT()`, `PQ()`, `Rme()`, `Wvt()`) |
| স্ল্যাশ কমান্ড / কমান্ড প্যালেট / হেল্প শিট | ✅ | কম্পোজার সেলেক্টর ঠিক হলেই |
| মেসেজ কিউ, কম্প্রেস/হ্যান্ডঅফ | ✅ | DOM-ড্রিভেন সেন্ড |
| মেমরি / প্রম্পট / পার্সোনা / স্কিল | ✅ | ইনজেকশন পেলোড-রিরাইটের ওপর নির্ভর → অ্যাডাপ্টার দরকার |
| প্রজেক্ট + RAG | ✅ | একই |
| MCP সার্ভার | ✅ | bridge fetch (NetworkGuard সহ) — সাইট-নিরপেক্ষ |
| **Deep Research (ইঞ্জিনের নিজস্ব)** | ✅ (সামান্য ঝুঁকি) | DuckDuckGo/Bing + bridge fetch; মডেলকে প্রম্পট দিয়ে চালানো হয়। শুধু স্টেটাস-কার্ড মাউন্ট পয়েন্ট যাচাই করতে হবে |
| **Linux স্যান্ডবক্স + এজেন্ট লুপ + Studio** | ✅ | টুল-ট্যাগ → `__sdEngine.sendQuiet()` → DOM সেন্ড; সেশন আইডি ও হিস্ট্রি শেপ ঠিক হলেই |
| এক্সপোর্ট (MD/PDF/HTML/ইমেজ) | ✅ | DOM থেকেই নেয় |
| ব্যাকআপ এক্সপোর্ট/ইমপোর্ট | ✅ | ব্রিজ স্টোরেজ |
| ৬ ভাষা / বাংলা UI | ✅ | `sdT()` + locale |
| কোড রানার (Pyodide/JS/TS/Lua/Ruby), চার্ট, ডকুমেন্ট | ✅ | `sandbox.js` আইসোলেটেড |
| টাইমস্ট্যাম্প, চ্যাট ট্যাগ, টোকেন কস্ট | ⚠️ অ্যাডাপ্ট/আনুমানিক | API শেপ ও `usage` নেই |
| সাইডবার সার্চ / রিনেম | ⚠️ অ্যাডাপ্ট | arena-র `/api/history/*` ব্যবহার করে নতুন করে লিখতে হবে |
| স্ট্যাটাস ব্যানার, ব্যালান্স, API প্লেগ্রাউন্ড, Harness | ❌ বন্ধ | DeepSeek সার্ভিস |

---

## ৫. আপনার দুই হার্ড রিকোয়ারমেন্ট — কোড-লেভেল গ্যারান্টি

### ৫.১ সাইডবারের অ্যাডভান্সড সেটিংস

**আজ যা হয়** (content.js `WQ()`, ১টি ম্যাচ): DeepSeek-এর `.ds-dropdown-menu` খুললে ইঞ্জিন
`.ds-dropdown-menu-option` স্ক্যান করে এমন অপশন খোঁজে যার লেবেলে `setting` / `সেটিংস` / `设置` /
`تنظیمات` / `настройк` / `ayar` আছে; তার **ঠিক পরে** `rw()` দিয়ে একটা আইটেম বসায়
(লেবেল: `sidebarMenu.advancedSettings` → "Advanced Settings" / "অ্যাডভান্সড সেটিংস"), ক্লিকে
`document.body.click()` + `window.dispatchEvent(new CustomEvent("bds:open-drawer"))`।

**arena-তে যা করা হবে:**
- `WQ()`-তে প্রোফাইল-ব্র্যাঞ্চ: arena-র সাইডবার অ্যাকাউন্ট/লগইন মেনু কনটেইনার খোঁজা
  (`[role="menu"]` / সাইডবারের sign-in বা avatar বাটন)।
- `rw()`-এর arena টুইন: আইটেমের *ভেতরের ক্লাস/মার্কআপ* arena-র নিজস্ব মেনু-আইটেমের মতো হবে
  (যেন দেখতে সাইটের সাথে মিলে যায়), কিন্তু **লেবেল, আইকন, ক্লিক-আচরণ ও ইভেন্ট একই থাকবে**।
- **ফলব্যাক (গুরুত্বপূর্ণ):** arena-র মেনু না মিললে সাইডবারে একটি স্থায়ী engine-owned রো
  বসানো হবে — এন্ট্রি কখনো হারাবে না। ড্রয়ার তখন `bds:open-drawer`-এই খুলবে।
- ড্রয়ারের ভেতরটা (`sdBuildOverview` লাইন ৩২৬০, `sdFillHeader`, `sdPageTitle`, `sdRow`, ১২টি পেজ,
  Back-স্ট্যাক, সার্চ, টিপ-বক্স) **এক অক্ষরও বদলাবে না**। `sdMountLinux()` (`#bds-drawer .sd-linux-page`)
  ও একই থাকবে — অর্থাৎ Linux & Agent রো/পেজও অক্ষুণ্ণ।

**কী বাস্তবায়িত হলো:** §১৬ (ফেজ-৪ প্রথমাংশ) — `WQ()`-তে arena ব্র্যাঞ্চ + `#bds-settings-rail`
ফলব্যাক, আর ড্রয়ারের ভেতরে হাত পড়েনি একেবারেই।

### ৫.২ প্লাস (+) শিট

**আজ যা হয়** (`$vt()`, অফসেট ২,৮৪১,৮৬৭): কম্পোজার টেক্সটএরিয়া (`iT()`) → ফাইল ইনপুট (`PQ()`)
→ কন্ট্রোল-রো (`Rme()`/`Qvt()`/`Wvt()`) খুঁজে সেখানে `.bds-attach-menu-mount` বসায়, তার ভেতরে
Svelte কম্পোনেন্ট `Lut` মাউন্ট করে; DeepSeek-এর নিজের অ্যাটাচ বাটন (`Yvt()`) লুকিয়ে দেয়।
কার্ড-সেট বান্ডলেই সংজ্ঞায়িত (`attach-menu-files`, `-photos`, `-camera`, `-deep-research`) —
`UiPolish.kt`-এর কমেন্ট অনুযায়ী এখানে Commands/DeepThink/Web Search/Deep Code নেই, তাই
DOM sweep লাগে না।

**arena-তে:** `iT()`-এর ফলব্যাক লিস্টে ইতিমধ্যে `textarea[placeholder]` আছে, তাই
`textarea[name="message"]` ধরা পড়বে; তবু প্রোফাইলে এক্সপ্লিসিট সেলেক্টর যোগ হবে।
`zvt()`/`Yvt()`-তে arena-র নিজের অ্যাটাচ/আপলোড বাটন চেনার হিন্ট যোগ করতে হবে, আর
`OS()`-এ React `_valueTracker` রিসেট (arena-utils যেটা করে) — নাহলে controlled ইনপুটে টেক্সট বসবে না।
**শিটের কার্ড, অর্ডার, লেবেল, আইকন, সুইচ, ড্র্যাগ-জেশ্চার — সব অপরিবর্তিত** (`Lut` ও
`.bds-attach-*` CSS-এ হাত দেওয়া হবে না)।

**যাচাই পদ্ধতি:** দুই বিল্ডের (DeepSeek / Arena) ড্রয়ার-ওভারভিউ ও প্লাস-শিটের স্ক্রিনশট পাশাপাশি
রেখে রো-সংখ্যা, অর্ডার, লেবেল, টগল-স্টেট মেলানো হবে (হারনেসে নতুন `attach-sheet` ও
আপডেটেড `settings-pages` সিনারিও)।

**কী বাস্তবায়িত হলো:** §১৭ (ফেজ-৪ দ্বিতীয়াংশ) — কম্পোজার/ফাইল-ইনপুট/কনটেইনার/মাউন্ট/সাইট-বাটন
সবই arena-সচেতন, আর শিট মাউন্ট করে এমনকি সাইটের ইনপুট এখনো তৈরি না হলেও; `Lut` কম্পোনেন্ট ও
`.bds-attach-*` CSS-এ হাত পড়েনি একেবারেই।

---

## ৬. হাই-ফিচার (Deep Research, Linux স্যান্ডবক্স) আসলে কতটা টিকবে

- **Linux স্যান্ডবক্স/এজেন্ট:** এজেন্ট লুপ চলে `__sdEngine.sendQuiet()` → কম্পোজারে টেক্সট →
  আসল সেন্ড বাটনে ক্লিক। arena-তে কম্পোজার ও সেন্ড বাটন চেনা গেলেই পুরো লুপ চলবে।
  যা লাগবে: (ক) সেশন আইডি `/c/{id}` থেকে, (খ) হিস্ট্রি রি-রিড (`bds:request-history-msgs` →
  arena `/api/chat/{id}/messages` ম্যাপিং, `chat_messages` শেপে), (গ) স্টপ-বাটন শনাক্তি
  (`POST /nextjs-api/stream/stop/...` চলাকালীন UI-তে কোন বাটন থাকে — ফেজ-০-তে ক্যাপচার),
  (ঘ) রিপ্লাই-এন্ড শনাক্তি: `.ds-cursor`/`_streaming` নেই → AI-SDK ফ্রেম (`text-delta` থামা) +
  টেক্সট-গ্রোথ স্টল + স্টপ→সেন্ড বাটন ট্রানজিশন।
- **Deep Research:** সার্চ/ফেচ সব `AndroidBridge.fetch` (NetworkGuard সহ) দিয়ে — সাইট-নিরপেক্ষ।
  শুধু রিপোর্ট/স্টেটাস কার্ডের মাউন্ট পয়েন্ট (মেসেজ রুট) arena-র `.prose` অনুযায়ী ঠিক করতে হবে।
- **ঝুঁকি:** arena-র ক্রেডিট/রেট-লিমিট এজেন্ট লুপ মাঝপথে থামিয়ে দিতে পারে। `bds:network-error`
  ইভেন্ট ইতিমধ্যে আছে; এর ওপর একটা স্পষ্ট নোটিশ/চিপ যোগ হবে (নীরবে আটকে থাকবে না)।

---

## ৭. প্রস্তাবিত আর্কিটেকচার: "Site Profile" seam (ফর্ক নয়)

### ৭.১ এক নতুন ফাইল + দুটি অ্যাসার্টেড প্যাচ

**নতুন:** `bds-assets/bds/sd-site.js` — ইনজেকশন ক্রমে **সবার আগে** (injected.js-এর আগে)।

```js
window.__sdSite = detect(location.host);      // 'deepseek' | 'arena'
window.__sdProfile = function (builtin) {      // in-place deep merge
  return deepMerge(builtin, PROFILES[__sdSite.id]);
};
```

**প্যাচ ১** (`content.js`, anchor `PH={features:{apiPlayground` — ম্যাচ ১):
`PH=` → `PH=(window.__sdProfile||function(x){return x})(`

**প্যাচ ২** (`content.js`, anchor `modelInputLimits:{instant:2621440,vision:2621440,expert:163840,deepthink:163840}},mw=` — ম্যাচ ১):
শেষের `}` → `})`

এতে **`PH` অবজেক্টটিই মিউটেট হয়** — অর্থাৎ যেসব কোড সরাসরি `PH.selectors.*` পড়ে (প্রায় সব),
সবাই arena-মান পায়। DeepSeek প্রোফাইল = আজকের ডিফল্ট হুবহু → **শূন্য রিগ্রেশন**।

### ৭.২ বাকি প্যাচগুলো একই নিয়মে (প্রতিটিতে ম্যাচ-কাউন্ট অ্যাসার্ট)

| ফাইল | প্যাচ | পদ্ধতি |
|---|---|---|
| `injected.js` | এন্ডপয়েন্ট কনস্ট্যান্ট + ফিল্টার `y(url)` | প্রোফাইল থেকে পড়া; arena সেট = `/nextjs-api/stream/create-chat`, `/nextjs-api/stream/post-to-evaluation/`, `/api/chat/*/messages` |
| `injected.js` | `I(e,t)` পেলোড রিরাইটার | শেপ-ডিটেক্টর যোগ: `message.parts[]` থাকলে `parts[0].text`-এর আগে কনটেক্সট; নাহলে বর্তমান `prompt[]` পথ |
| `injected.js` | SSE পার্সার (`ve`, `Ce`) | AI-SDK ফ্রেম (`data: {"type":"text-delta","delta":…}`) ও `records:[{body:…}]` সাপোর্ট; `usage` না থাকলে টোকেন-ইভেন্ট বন্ধ |
| `content.js` | `eF()` | প্রোফাইল regex (`/c/([^/]+)`) |
| `content.js` | `sdNewChat()` (৩টি URL লিটারেল) | প্রোফাইল `urlPatterns.base` |
| `content.js` | `WQ()` + `rw()` | §৫.১ |
| `content.js` | `.ds-icon-send` (৫) / `.ds-icon-stop-circle` (৫) | প্রোফাইল `sendButton`/`stopButton` (ইতিমধ্যে কনফিগে আছে) + aria-label ফলব্যাক |
| `content.js` | `_2090548` (২), `status.deepseek.com` (২), `api.deepseek.com/user/balance` (২), লোগো viewBox (২) | প্রোফাইল / ফিচার-ফ্ল্যাগ বন্ধ |
| `sd-agent.js` | `.ds-icon-send` (১), `.ds-icon-stop-circle` (৩), `chat_messages` (২) | প্রোফাইল + হিস্ট্রি ম্যাপার |
| `sd-health.js` | `CHECKS` অ্যারে | প্রোফাইল-ভিত্তিক ল্যান্ডমার্ক (arena: কম্পোজার, `main ol.flex-col-reverse`, `.prose`, সেন্ড বাটন, `/c/` লিংক) |
| `our-skin.css` | `.ds-markdown` bidi রুল | `.prose` টুইন যোগ (DeepSeek রুল রেখে) |
| `UiPolish.kt` | sweep প্যাটার্ন | প্রোফাইল-ড্রিভেন (arena-তে Voice/Deep Code/Get-App sweep বাদ; কমান্ড-ম্যানেজার রিপেয়ারের কম্পোজার সেলেক্টর arena-রটা) |
| Kotlin | `ChatUrls.kt`, `MainActivity.kt` (DS_HOST/shouldOpenExternally/loadUrl), `PageActions.kt`, `AndroidManifest.xml` | নতুন `Site.kt` — এক জায়গায় হোস্ট/প্যাটার্ন/এক্সটার্নাল-লিংক নিয়ম |

### ৭.৩ প্যাকেজিং — তিন অপশন

| অপশন | কী | সুবিধা | খরচ/ঝুঁকি |
|---|---|---|---|
| **A (প্রস্তাবিত)** | **আলাদা অ্যাপ**: Gradle product flavor `arena` → `applicationId com.superarena.app`, নিজের নাম/আইকন/কিস্টোর; একই ইঞ্জিন বান্ডেল, প্রোফাইল হোস্ট দিয়ে বেছে নেওয়া | Super DeepSeek-এর ফ্রোজেন আইডেন্টিটি ও আপডেট-চেইন অক্ষুণ্ণ (MASTER-PROMPT রুল ২); দুই অ্যাপ পাশাপাশি ইনস্টল; ঝুঁকি আলাদা | CI-তে দ্বিতীয় জব; দুই APK |
| B | এক অ্যাপে সাইট-সুইচার সেটিং | এক বিল্ড | `bds_*` স্টোরেজ কি গ্লোবাল → মেমরি/প্রম্পট দুই সাইটে মিশে যাবে (কি-নেমস্পেসিং লাগবে); ফ্রোজেন আইডেন্টিটি রুল ভাঙে; QA ম্যাট্রিক্স দ্বিগুণ |
| C | রিপো ফর্ক | দ্রুত শুরু | ডাইভার্জেন্স; শেয়ার্ড ফিক্স বন্ধ — বাতিল |

**সুপারিশ: A**, সাথে একটি শেয়ার্ড `bds-assets` (কোনো ডুপ্লিকেট বান্ডেল নয়) এবং ফ্লেভার-ভিত্তিক
নাম/আইকন/`applicationId`/রিপোজিটরি-রিলিজ। নেমিং সতর্কতা: "Arena" ট্রেডমার্ক এড়াতে অ্যাপের নাম
যেন অফিসিয়াল মনে না হয় (যেমন *Super Arena* নয় বরং নিরপেক্ষ কিছু, অথবা স্পষ্ট
"unofficial" ডিসক্লেমার) — README-তে DeepSeek-এর মতোই "not affiliated" লাইন।

---

## ৮. ফেজ-ভিত্তিক বাস্তবায়ন (প্রতিটি ফেজে red→green প্রমাণ বাধ্যতামূলক)

### ফেজ ০ — গ্রাউন্ড ট্রুথ ক্যাপচার ⛔ (ব্লকার, ০.৫–১ দিন, owner/নেটওয়ার্ক-সক্ষম পরিবেশ)
- এই স্যান্ডবক্সে `arena.ai` পৌঁছানো যায় না; হারনেস ফিক্সচার "মডেল" হলে তা
  `tools/harness/README.md`-এর provenance সতর্কতার মতোই অসম্পূর্ণ প্রমাণ দেবে।
- ডেলিভারেবল: `tools/capture/arena-capture.md` (নির্দেশিকা) + owner-করা ক্যাপচার →
  `tools/harness/fixture/arena.html` (ব্যক্তিগত ডেটা মুছে) + HAR (ফ্রিমুক্ত) + নিশ্চিত করা
  সেলেক্টর/এন্ডপয়েন্ট টেবিল + স্টপ-বাটন ও স্ট্রিমিং DOM-এর স্ন্যাপশট।
- **Exit:** §২.১-এর টেবিলের প্রতিটি সেলেক্টর ক্যাপচারে মিলেছে; না মিললে টেবিল আপডেট।

### ফেজ ১ — প্রোফাইল seam (DeepSeek-এ শূন্য পরিবর্তন) — ✅ সম্পন্ন, বিবরণ §১৩
- `sd-site.js` + `Site.kt` + প্যাচ ১/২ (§৭.১)।
- টেস্ট: নতুন `engine-site-profile.test.mjs` (মার্জ সেমান্টিক্স; deepseek প্রোফাইল == বিল্ট-ইন;
  seam-anchor দুটি এখনও ১টি করে ম্যাচ — আপস্ট্রিম রিপ্লেস হলেই লাল হবে)।
- **Exit:** `npm run test:engine` (১০৫+) সবুজ · `npm run test:harness` ৭ pass/০ fail ·
  `./gradlew testDebugUnitTest` সবুজ · ডিভাইসে DeepSeek বিল্ড আগের মতোই।

### ফেজ ২ — নেটিভ শেল রি-টার্গেট — ✅ সম্পন্ন, বিবরণ §১৪
- `isTrustedBridgeUrl`/`restorable` (`^/c/[A-Za-z0-9-]{1,80}/?$`)/`DS_HOST`/blob হোস্ট/
  `shouldOpenExternally` (arena.ai in-app; Google auth in-app; reCAPTCHA ডোমেইন in-app)/
  manifest deep-link/shortcuts।
- টেস্ট: `ChatUrlsTest`, `MainFrameTrustTest`, `WebViewNavigationTest`, `AndroidLinkRoutingTest`,
  `UserAgentMetadataTest`-এ arena কেস (আগে লাল, পরে সবুজ)।
- **Exit:** arena.ai WebView-তে লোড, সাইন-ইন সফল, ব্রিজ শুধু arena.ai-তে ট্রাস্টেড,
  ইঞ্জিন শুধু মেইন ফ্রেমে।

### ফেজ ৩ — কোর লুপ অ্যাডাপ্টার — 🟡 অংশ সম্পন্ন, বিবরণ §১৫ (কম্পোজার/সেন্ড/স্ট্রিম/সেশন) — ৩–৫ দিন ⭐ ক্রিটিক্যাল পাথ
- §৭.২-এর injected.js + `eF()` + `OS()` (React `_valueTracker`) + সেন্ড/স্টপ + মেসেজ/রোল +
  স্ট্রিমিং শনাক্তি + `column-reverse` স্ক্রল ম্যাথ ঠিক করা।
- হারনেসে arena ফিক্সচার নিয়ে সিনারিও: `agent-once`, `no-rerun`, `keep-going`,
  `scroll-guard-reversed`, `slash-commands`, `bidi-text`, `themes` — প্রতিটি আগে লাল।
- **Exit:** রিয়েল ডিভাইসে arena Direct Chat-এ এজেন্ট চেইন (টুল-ট্যাগ → স্যান্ডবক্স → ফলাফল →
  কন্টিনিউ → শেষ) পুরোটা চলে; স্ক্রল-গার্ড উল্টো লিস্টেও ঠিক।

### ফেজ ৪ — দুই সুরক্ষিত সারফেস — ২–৩ দিন ⭐ (আপনার হার্ড রিকোয়ারমেন্ট)
- §৫.১ ও §৫.২ বাস্তবায়ন + ফলব্যাক + স্ক্রিনশট-ডিফ যাচাই।
- **Exit:** দুই বিল্ডের স্ক্রিনশটে ড্রয়ারের সব রো/সেকশন/অর্ডার/লেবেল (বাংলা সহ) ও প্লাস-শিটের
  সব কার্ড এক; ড্র্যাগ-ডিসমিস, Back-স্ট্যাক, সার্চ একই আচরণ।

### ফেজ ৫ — ফিচার ট্রায়েজ ও বাকি অ্যাডাপশন — ৩–৪ দিন
- হিস্ট্রি/রিনেম/সার্চ/ট্যাগ/টাইমস্ট্যাম্প/mapping; স্ট্যাটাস-ব্যালান্স-প্রাইসিং-Harness বন্ধ;
  মডেল ডিটেকশন `?model_a=` থেকে; প্রতিটি বন্ধ ফিচারের UI এন্ট্রিও লুকানো (ডেড কন্ট্রোল নয়)।
- **Exit:** কোথাও অচল বাটন/রো নেই; `sd-health.js` arena ল্যান্ডমার্ক সবুজ; ব্র্যান্ড-চেক পাস।

### ফেজ ৬ — হার্ডেনিং, QA, রিলিজ — ২–৩ দিন
- সিকিউরিটি রি-অডিট: নতুন হোস্টে ব্রিজ-ট্রাস্ট, injected.js-এর auth-token স্নিফার (`h()`) যেন
  arena-র JWT তুলে না নেয়/লগে না যায়, reCAPTCHA iframe যেন বিশ্বাস না পায়, NetworkGuard অপরিবর্তিত।
- এমুলেটর স্মোক (`android/ci/emulator-smoke.sh`), CI ওয়ার্কফ্লোতে ফ্লেভার জব, সাইনড APK,
  in-app আপডেট চ্যানেল (নতুন রিপো/অ্যাসেট প্রিফিক্স), ডকস আপডেট
  (`docs/ARCHITECTURE.md`-এ প্রোফাইল লেয়ার, README, নতুন `docs/arena/REPORT-BN.md`)।

**মোট অনুমান: ~১২–১৮ কর্মদিবস** (ফেজ-০ owner-নির্ভর; ফেজ-৩ ও ৪ ক্রিটিক্যাল পাথ)।

---

## ৯. ঝুঁকি রেজিস্টার

| # | ঝুঁকি | প্রভাব | মোকাবিলা |
|---|---|---|---|
| ১ | এই স্যান্ডবক্সে arena.ai অ্যাক্সেস নেই | ফেজ-০ ব্লকড | owner-ক্যাপচার কিট, অথবা নেটওয়ার্ক-সক্ষম পরিবেশে স্পাইক |
| ২ | `recaptchaV3Token` + Trigger.dev টোকেন | সরাসরি API সেন্ড ব্যর্থ | সবসময় DOM-ড্রিভেন সেন্ড (বর্তমান `$W()` পথই) |
| ৩ | Battle/Side-by-side = দুই পেন/দুই স্ট্রিম + ভোট বাধ্যতামূলক | এজেন্ট লুপ ও run-once গেট ভাঙে | **শুধু Direct Chat টার্গেট**; Battle-তে `sd-health` নোটিশ দিয়ে ইঞ্জিন-এক্সট্রা বিরত |
| ৪ | `ol.flex-col-reverse` | স্ক্রল-গার্ড/অটো-স্ক্রল উল্টো (এই রিপোতে আগেই বাগ #৭ এখানে হয়েছিল) | ফেজ-৩-এ dedicated সিনারিও `scroll-guard-reversed` |
| ৫ | Tailwind ইউটিলিটি ক্লাস + `data-testid` প্রায় নেই | সাইট রিডিজাইনে ড্রিফট | role/structure ফলব্যাক + `sd-health` ল্যান্ডমার্ক + ফেজ-০ ক্যাপচার টেস্ট |
| ৬ | স্ট্রিমে `usage` নেই | টোকেন কস্ট/কনটেক্সট গার্ড ভুল হবে | লোকাল অনুমান (টিকার-ভিত্তিক) অথবা ফিচার বন্ধ; `modelInputLimits` রক্ষণশীল ডিফল্ট |
| ৭ | **arena.ai-র ToS / লিডারবোর্ড ইন্টিগ্রিটি** | অটোমেশন/ভোট দূষণ হলে অ্যাকাউন্ট ব্যান ও আইনি ঝুঁকি | শুধু Direct Chat (ভোট গণনা হয় না), ভোট অটোমেট নয়, রেট-লিমিট মানা, ক্রেডিট শেষ হলে থামা, README-তে স্পষ্ট নীতি |
| ৮ | ট্রেডমার্ক/ব্র্যান্ডিং | "Arena" নামে অফিসিয়াল মনে হওয়া | নিরপেক্ষ অ্যাপ-নাম + "not affiliated" ডিসক্লেমার; `sds-brand-check.mjs` ফ্লাভার-অনুযায়ী আপডেট |
| ৯ | `bds-sync.sh` আপস্ট্রিম ডিফ | seam-anchor হারালে নীরব ভাঙন | anchor-অ্যাসারশন টেস্ট + ARCHITECTURE-তে seam ডকুমেন্টেশন |
| ১০ | এক অ্যাপে দুই সাইট (অপশন B) হলে স্টোরেজ মিশে যাওয়া | মেমরি/প্রম্পট লিক | অপশন A, অথবা কি-নেমস্পেসিং |

---

## ১০. ফাইল-ভিত্তিক ইনভেন্টরি (প্রতিটি ফাইলের ভাগ্য)

**অপরিবর্তিত (রিপোর ১৬১টি ট্র্যাকড ফাইলের সংখ্যাগরিষ্ঠ অংশ):** সব `Sandbox*.kt`, `Studio*.kt`, `TarGz.kt`, `ShellProtocol.kt`,
`Utf8Chunker.kt`, `NetworkGuard.kt`, `MainFrameTracker.kt`, `Downloads.kt`, `EngineStore.kt`,
`NativeBlobStore.kt`, `WebViewBridge.kt` (শুধু হোস্ট প্যারামিটার), `BootScreenView.kt` (মেকানিক্স),
`sd-native.js`, `sd-sheets.js`, `sandbox.js`, `sandbox.html`, `static/*`,
`network_security_config.xml`, `bds_file_provider_paths.xml`, সব drawable/font/mipmap,
`scripts/fetch_sandbox_deps.py`, `tools/harness/harness.mjs`/`run.mjs` (DeepSeek অংশ),
সব বিদ্যমান টেস্ট ফাইল (নতুন কেস যোগ হবে, পুরনো বদলাবে না)।

**প্রোফাইল-ড্রিভেন প্যাচ (১১টি):** `content.js`, `injected.js`, `sd-agent.js`, `sd-health.js`,
`content.css` (৪টি `.ds-*` রুলের টুইন), `our-skin.css`, `UiPolish.kt`, `ChatUrls.kt`,
`MainActivity.kt`, `PageActions.kt`, `AndroidManifest.xml`।

**নতুন (৬টি):** `bds-assets/bds/sd-site.js`, `Site.kt` (+টেস্ট),
`android/app/src/test/js/engine-site-profile.test.mjs`, `tools/harness/fixture/arena.html`,
`tools/capture/arena-capture.md`, ফ্লেভার রিসোর্স (`values-arena/`, আইকন, `strings`)।

**ব্র্যান্ডিং/রিলিজ:** `strings.xml` (+bn/fa/ru/tr/zh), `themes.xml`/`colors.xml`, `shortcuts.xml`,
`UpdateChecker.kt` (রিপো + `super-deepseek` অ্যাসেট প্রিফিক্স), `build.gradle.kts` (ফ্লেভার),
`.github/workflows/build-and-release-apk.yml`, `scripts/sds-brand-check.mjs`, README/ARCHITECTURE।

---

## ১১. স্কোপ-বাইরে আবিষ্কার (রেপো হাইজিন — অনুমতি ছাড়া বদলানো হবে না)

সweep-এ যেগুলো চোখে পড়েছে, এগুলো এই পোর্টের অংশ নয় কিন্তু রিপোর্ট করা দরকার:

1. **`AGENTS.md` (৩৫১ লাইন) সম্পূর্ণ ভিন্ন প্রজেক্টের** — "Grok Build / App Builder" কন্ট্রাক্ট
   (`/workspace`, TanStack Start, পোর্ট ৮০৮০, `npm run dev`, imagine_* টুল)। এই অ্যান্ড্রয়েড
   রিপোর সাথে মিল নেই; এজেন্টদের ভুল পথে নিতে পারে।
2. **`startup.sh`** ভাঙা — `cd /workspace` ও `scripts/preview.mjs` (ফাইলটি নেই)।
3. **`package.json`** — React SPA-র ~৫০টি ডিপেন্ডেন্সি এখনও আছে অথচ `src/` ডিরেক্টরিই নেই
   (ARCHITECTURE.md "Legacy code" সেকশনও `src/`-এর কথা বলে); `test:app`/`typecheck` স্ক্রিপ্ট
   নেই কিন্তু `docs/qa/PLAN.md` ও CI ডকস সেগুলোর রেফারেন্স দেয়।
4. **CI ট্রিগার ব্র্যাঞ্চ তালিকা** পুরনো arena শাখাগুলো ধরে রেখেছে
   (`arena/01a0cebd-deepseek`, `arena/01a0dc4d-deepseek`) — এই শাখায় CI চলবে না।

---

## ১১.১ মাপা বেসলাইন (আজ, ১১ অক্টোবর ২০২৬, এই স্যান্ডবক্সে চালিয়ে)

| চেক | ফলাফল | মন্তব্য |
|---|---|---|
| `npm run test:engine` | ✅ **১০৫/১০৫ pass, ০ fail** (~২৩s) | `docs/qa/PLAN.md`-এর দাবির সাথে মিলে যায় |
| — `node_modules` ছাড়া | ⚠️ ২টি ফাইল `ERR_MODULE_NOT_FOUND` (`acorn`) → ৭৭/৭৯ | `acorn` সরাসরি ডিপেন্ডেন্সি নয়, eslint-এর ট্রানজিটিভ; তাই **`npm ci` ছাড়া বেসলাইন মিথ্যা লাল দেখায়** |
| `npm run test:template` | ✅ ২৮/২৮ | ⚠️ `docs/qa/PLAN.md` এখনও "১৯২/১৯২" দাবি করে — পুরনো (তখন `src/` ছিল) |
| `npm run test:harness` | ❌ চালানো যায়নি | `@sparticuz/chromium` লোড হয় কিন্তু `libnss3.so` নেই (এই স্যান্ডবক্সে `apt` নেই) → **ফেজ-১/৩/৪-এর হারনেস প্রমাণ CI বা সিস্টেম-লিবসহ পরিবেশে চালাতে হবে** |
| `./gradlew testDebugUnitTest` | ❌ চালানো যায়নি | এখানে JDK/Android SDK নেই (`java` নেই, `ANDROID_HOME` unset) → Kotlin প্যাচের প্রমাণ **CI-তেই** নিতে হবে; কিন্তু ওয়ার্কফ্লোর ট্রিগার-তালিকায় এই শাখা নেই (§১১.৪) |

**অর্থ:** ফেজ-১-এর "শূন্য রিগ্রেশন" প্রমাণের জন্য দুটি পূর্বশর্ত আগে ঠিক করতে হবে —
(ক) CI ওয়ার্কফ্লোতে এই শাখা/ফ্লেভার যোগ, (খ) হারনেস চালাতে পারে এমন রানার
(`libnss3` সহ) অথবা হারনেসকে CI-র একটি আলাদা জবে নেওয়া।

---

## ১২. সিদ্ধান্ত (owner দিয়েছেন, ১১ অক্টোবর ২০২৬)

| # | প্রশ্ন | সিদ্ধান্ত |
|---|---|---|
| ১ | টার্গেট মোড | ✅ **শুধু Direct Chat** — Battle/Side-by-side সাপোর্ট নয় (ওখানে ইঞ্জিন-এক্সট্রা বিরত থাকবে, হেলথ-নোটিশ দেখাবে) |
| ২ | প্যাকেজিং | ✅ **আলাদা অ্যাপ / Gradle ফ্লেভার** — Super DeepSeek-এর আইডেন্টিটি, কিস্টোর ও আপডেট-চেইন অক্ষুণ্ণ |
| ৩ | ক্যাপচার | ✅ **পাবলিক প্রমাণ দিয়ে মডেল-ফিক্সচার** (`arena-utils` + পাবলিক API-ম্যাপ), পরে রিয়েল ক্যাপচার দিয়ে যাচাই — তাই প্রোফাইলের প্রতিটি মান `VERIFIED` / `MODELLED` চিহ্নিত |
| ৪ | পরবর্তী পদক্ষেপ | ✅ **ফেজ-১ শুরু** — শূন্য-রিগ্রেশন seam |
| ৫ | অ্যাপের নাম/ব্র্যান্ডিং | ⏳ খোলা — ফেজ-২-তে ফ্লেভার বসানোর আগে দরকার |

---

## ১৩. ফেজ-১ অগ্রগতি (সম্পন্ন ✅)

**যা করা হয়েছে:**

| পরিবর্তন | ফাইল |
|---|---|
| নতুন সাইট-প্রোফাইল লেয়ার (সবার আগে ইনজেক্ট হয়) | `android/app/src/main/bds-assets/bds/sd-site.js` |
| seam: বিল্ট-ইন কনফিগ `PH` এখন `__sdProfile(...)`-এর ভেতর দিয়ে যায় (২টি অ্যাসার্টেড সিঙ্গল-ম্যাচ প্যাচ, +৪৫ অক্ষর) | `android/app/src/main/bds-assets/bds/content.js` |
| ইনজেকশন ক্রমে `sd-site.js` যুক্ত (injected.js-এর আগে) | `MainActivity.kt` (`loadEngineAssets`) |
| হারনেসও একই ক্রম মানে | `tools/harness/harness.mjs` (`ENGINE_SEQUENCE`) |
| ১০টি নতুন গার্ড-টেস্ট | `android/app/src/test/js/engine-site-profile.test.mjs` |
| ডকুমেন্টেশন | `docs/ARCHITECTURE.md` ("The site-profile seam"), `tools/harness/README.md`, `scripts/bds-sync.sh` সতর্কতা |
| এই শাখায় CI চালু (রিলিজ নয়) | `.github/workflows/build-and-release-apk.yml` |

**প্রমাণ (এই স্যান্ডবক্সে চালানো):**

- `npm run test:engine` → **১১৫/১১৫ pass, ০ fail** (বেসলাইন ১০৫ + নতুন ১০)
- `npm run test:template` → ২৮/২৮
- `node scripts/sds-brand-check.mjs` → pass
- `npx eslint sd-site.js engine-site-profile.test.mjs harness.mjs` → ০ warning / ০ error
- `node --check content.js` → parses OK
- AST-প্রমাণ: `PH`-র init এখন `CallExpression`, callee হুবহু
  `window.__sdProfile||function(x){return x}`, arg0 = আসল ৪৪৪৩-অক্ষরের কনফিগ লিটারেল
- শূন্য-রিগ্রেশন প্রমাণ: `chat.deepseek.com` ও অজানা যেকোনো হোস্টে `__sdProfile(cfg) === cfg`
  (identity) এবং `deepEqual(cfg, snapshot)` — আসল বিল্ট-ইন কনফিগের ওপর টেস্ট করা
- UI-গ্যারান্টি টেস্ট: arena প্রোফাইলে `features.attachMenu` ও `features.sideBarMenuInjector`
  **নেই** (assert `undefined`), এবং মার্জের পরেও দুটোই বিল্ট-ইনের সাথে deep-equal →
  প্লাস-শিটের কার্ড-সেট ও অ্যাডভান্সড-সেটিংস ইনজেক্টর অক্ষুণ্ণ

**CI প্রমাণ (GitHub Actions রান [`38171450656`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38171450656), শাখা `arena/43c0caca-super-deepseek`) — সব জব ✅:**

| জব | ফল | কী প্রমাণিত হলো |
|---|---|---|
| Build & Verify APK | success | `MainActivity.kt` কম্পাইল হয়, `testDebugUnitTest` সবুজ, release APK বিল্ড + সাইনেচার ভেরিফাই |
| Engine harness (report only) | success | `sd-site.js` সবার আগে ইনজেক্ট হওয়া সত্ত্বেও পুরো ইঞ্জিন-হারনেস আগের মতোই pass — DeepSeek আচরণে শূন্য পরিবর্তনের রানটাইম প্রমাণ |
| Emulator smoke (API 30) | success | ইমুলেটরে অ্যাপ বুট + ইনজেকশন ঠিক আছে |
| Emulator smoke (API 34) | success | একই, নতুন API লেভেলে |
| Lint (report only) | success | নতুন ব্লকিং lint নেই |

CI-র শাখা-ট্রিগারে `arena/43c0caca-super-deepseek` যোগ করা হয়েছে (রিলিজ জব এখনও
tag/main-গেটেড → কোনো APK পাবলিশ হয়নি)।

**ফেজ-১ exit শর্ত: ✅ পূর্ণ** — একমাত্র বাকি ডিভাইসে DeepSeek বিল্ড হাতে চালিয়ে দেখা
(এখানে ডিভাইস নেই)। `Site.kt` ইচ্ছাকৃতভাবে ফেজ-২-এ রাখা হয়েছে (Kotlin-সাইড
রি-টার্গেট একসাথে হলে CI-প্রমাণ এক রানেই মিলবে)।


---

## ১৪. ফেজ-২ অগ্রগতি — নেটিভ রি-টার্গেট + আলাদা অ্যাপ (ফ্লেভার)

**অ্যাপের পরিচয় (owner-সিদ্ধান্ত):** **Arena Deck** · `applicationId com.arenadeck.app` ·
লঞ্চ-আইকন: শুরুতে Super DeepSeek-এরটিই ছিল; নিজস্ব আইকন ও "অ-সম্পৃক্ত" বিজ্ঞপ্তি এখন **§১৯-এ ✅**।

| কী | ফাইল |
|---|---|
| নতুন `SiteProfile` (hosts, baseUrl, newChatUrl, sessionPath, inAppHostSuffixes, composerSelectors, selfUpdateEnabled) + `Sites.DEEPSEEK/ARENA/ACTIVE` + `composerLookupJs()` | `Site.kt` (নতুন) |
| `isTrustedBridgeUrl` / `ChatUrls.restorable` সাইট-প্যারামিটারযুক্ত; `www.` alias ক্যানোনিকাল হোস্টে ফেরত যায় | `ChatUrls.kt` |
| `isChatDeepLink` / `parseIncomingIntent` সাইট-প্যারামিটারযুক্ত | `PageActions.kt` |
| `DS_HOST` ফিল্ড বিদায় → `site = Sites.ACTIVE`; মাইক-গেট, সার্ভিস-ওয়ার্কার ব্লব-গেট, মেইন-ফ্রেম ব্লব-গেট, কোল্ড-স্টার্ট/রিস্টোর URL, "Ask the AI" কম্পোজার, `UiPolish.buildScript(site)`, আপডেটার-গেট; `shouldOpenExternally`/`shouldCapturePopupInApp`/`shouldOpenRequestExternally`-এ `site` প্যারামিটার | `MainActivity.kt` |
| `buildScript(site)`; কম্পোজার লুকআপ এখন প্রোফাইল থেকে আসে — DeepSeek-এর `#chat-input` হার্ডকোড আর নেই | `UiPolish.kt` |
| `flavorDimensions "site"` + `deepseek` / `arenaDeck` ফ্লেভার, `SITE_ID` ও `${siteHost}` প্লেসহোল্ডার। **defaultConfig-এর `applicationId com.superdeepseek.app`, versionName, সাইনিং-কনফিগ অছোঁয়া** | `android/app/build.gradle.kts` |
| ডিপ-লিঙ্ক হোস্ট → `${siteHost}` (ফ্লেভার ঠিক করে, তাই এক বিল্ড অন্য সাইটের লিঙ্ক দাবি করতে পারে না) | `AndroidManifest.xml` |
| `app_name` / `bds_boot_title` = "Arena Deck" + "arena.ai-এর সাথে সম্পর্কিত নয়" নোট | `src/arenaDeck/res/values/strings.xml` (নতুন) |
| দুই ফ্লেভারের টেস্ট (`testDeepseekDebugUnitTest` + `testArenaDeckDebugUnitTest`), `assembleDeepseekRelease` + `assembleArenaDeckRelease`, ফ্লেভার-স্কোপড APK খোঁজ, **APK-তে `sd-site.js` আছে কি না চেক**, আলাদা `arena-deck-apk` আর্টিফ্যাক্ট (রিলিজে কখনও যাবে না), `lintDeepseekDebug`/`lintArenaDeckDebug`, ইমুলেটর-স্মোক শুধু `assembleDeepseekDebug` | `.github/workflows/build-and-release-apk.yml` |
| APK-পাথ গ্লোব ফ্লেভার-সচেতন | `android/ci/emulator-smoke.sh` |
| `MainFrameTracker.trustedForPage` / `shouldInjectEngine`-এও `site` প্যারামিটার (ব্রিজ-ট্রাস্ট ও ইঞ্জিন-ইনজেকশন ফ্লেভার মানে) | `MainFrameTracker.kt` |
| নতুন `SiteTest.kt` (১২টি টেস্ট) + `MainFrameTrackerTest`-এ ১টি নতুন; `ChatUrlsTest` / `PageActionsTest` / `AndroidLinkRoutingTest` / `UiPolishTest` সাইট **স্পষ্টভাবে পিন** করে; `MainFrameTrackerTest` / `MainFrameTrustTest` / `WebViewNavigationTest` এখন URL গড়ছে `Sites.ACTIVE` থেকে — অর্থাৎ একই টেস্ট দুই ফ্লেভারেই সত্যি অর্থ বহন করে | `android/app/src/test/…` |

**ডিজাইন-নীতি (গুরুত্বপূর্ণ):** সাইট এখন একটি *প্যারামিটার* যার ডিফল্ট `Sites.ACTIVE` —
কোনো গ্লোবাল হার্ডকোড নয়। ফলে একই টেস্ট দুই ফ্লেভারেই একই অর্থ দেয়; কোনো টেস্ট
"কোন ভ্যারিয়েন্ট চলছে" তার ওপর নির্ভরশীল নয়। ইঞ্জিন-সাইডে একই কাজ করে `sd-site.js`
(`location.host` দেখে), তাই নেটিভ আর JS কখনওই ভিন্ন সাইট ধরে নিতে পারে না।

**ফেজ-২-তে ইচ্ছাকৃতভাবে বাদ:** Arena Deck-এর ইন-অ্যাপ আপডেটার (`selfUpdateEnabled = false`) —
আপডেটার এই রিপোজিটরির রিলিজ পড়ে, যেখানে Super DeepSeek APK থাকে (ভিন্ন applicationId),
তাই সেটা Arena Deck-এর আপডেট হতেই পারে না। নিজস্ব রিলিজ-চ্যানেল হলে চালু হবে।

**এখনও অ্যাডাপ্ট হয়নি (ফেজ-৩-এর কাজ):** ইঞ্জিন-সাইটের DOM/এন্ডপয়েন্ট। হার্ডকোড-গণনা:
`injected.js`-এ ৯টি `/api/v0`, `content.js`-এ ১৬টি `deepseek.com` / ৬টি `chat.deepseek.com` /
৩টি `/api/v0`, `sd-native.js`-এ ১টি হোস্ট। অর্থাৎ Arena Deck এখন ইনস্টল-বুট হবে,
arena.ai লোড হবে, কিন্তু কম্পোজার/মেসেজ/এন্ডপয়েন্ট অ্যাডাপ্টার ছাড়া ইঞ্জিন-এক্সট্রা
(প্রম্পট ইনজেকশন, টুল-ট্যাগ, এক্সপোর্ট ইত্যাদি) কাজ করবে না — এটাই ফেজ-৩।

**CI-র শিক্ষা (প্রথম রান `38185324933`):** `Build & Verify APK` লাল হয়েছিল — arenaDeck
ভ্যারিয়েন্টে `MainFrameTrackerTest`/`MainFrameTrustTest` ফেল করছিল, কারণ ওগুলো DeepSeek URL
হার্ডকোড করে ডিফল্ট সাইটের ওপর নির্ভরশীল ছিল (ঠিক যে দুর্বলতা এড়ানোর জন্য সাইটকে
প্যারামিটার বানানো হয়েছিল)। এখন ওগুলো `Sites.ACTIVE` থেকে URL গড়ে; ইমুলেটর-স্মোক
(API 30/34/35), হারনেস ও lint সেই রানেই সবুজ ছিল।

**ফেজ-২ প্রমাণ — CI রান [`38185834895`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38185834895), সব জব ✅:**

| জব | ফল | কী প্রমাণিত হলো |
|---|---|---|
| Build & Verify APK | success | **দুই ফ্লেভারের** ইউনিট টেস্ট (`testDeepseekDebugUnitTest` + `testArenaDeckDebugUnitTest`) সবুজ, দুই রিলিজ APK বিল্ড, `apksigner verify` pass, `sd-site.js` APK-তে স্টেজ হয়েছে |
| Emulator smoke API 30 / 34 / 35 | success | Super DeepSeek ইমুলেটরে বুট + ইনজেকশন আগের মতোই (ফ্লেভার যোগ হওয়ার পরেও) |
| Engine harness | success | ইঞ্জিন আচরণে শূন্য পরিবর্তন |
| Lint (দুই ফ্লেভার) | success | নতুন ব্লকিং lint নেই |
| Publish Release | skipped (ডিজাইন অনুযায়ী) | শাখাটি main/tag নয় → কোনো APK পাবলিশ হয়নি |

আর্টিফ্যাক্ট: `super-deepseek-apk` (৭,৩৭৪,৬৯৩ B) ও `arena-deck-apk` (৭,৩৭৫,০৭৬ B) — দুটোই
বিল্ড হয়েছে; রিলিজে শুধু Super DeepSeek-টিই যায়।

**এখন যা বাকি:** ফেজ-৩ (ইঞ্জিন-সাইড অ্যাডাপ্টার) — arena.ai-এ কম্পোজার/মেসেজ/এন্ডপয়েন্ট;
এবং Arena Deck-এর নিজস্ব লঞ্চার আইকন (আপাতত Super DeepSeek-এর আইকনই আছে)।


---

## ১৫. ফেজ-৩ অগ্রগতি — ইঞ্জিন-সাইড অ্যাডাপ্টার (কোর লুপ)

**আবিষ্কার (গুরুত্বপূর্ণ):** বান্ডল কনফিগ পড়ে দুইভাবে — (ক) `Ki.getConfig("dot.path")`
মাত্র ১২ জায়গায়, (খ) বাকি সব জায়গায় কনফিগ-অবজেক্টটি একটি ক্লাসের প্রাইভেট ফিল্ডে ধরা হয়
(`ir(this,gT,PH)`), অর্থাৎ **সব রিডারের হাতে একই অবজেক্ট-রেফারেন্স**। তাই ফেজ-১-এর
in-place মার্জ সত্যিই প্রতিটি রিডারে পৌঁছায় — এটা এখন প্রমাণিত, অনুমান নয়।

**কভারেজ মাপা হলো:** বিল্ট-ইন কনফিগে ১০টি টপ-লেভেল কী, **১৪৮টি লিফ**। ফেজ-৩-এর আগে
arena ওভাররাইড করত ৩৮টি; এখন **৪৪টি + ১টি নতুন কী** (`api.historyMessagesPath`)। বাকি
১০৪টি লিফের প্রতিটি এখন প্রমাণসহ শ্রেণীবদ্ধ:

| শ্রেণি | সংখ্যা | কী |
|---|---|---|
| owner-protected | ৩৪ | `features.attachMenu.*` (৩৩) + `sideBarMenuInjector` — টেস্ট দাবি করে এগুলো ওভাররাইড করা **যাবে না** |
| unread (প্রমাণিত) | ২৪ | কী-নামটি পুরো ৩.৩ MB বান্ডলে **একবারই** আছে (শুধু কনফিগ-লিটারালে) → কেউ পড়ে না; যেমন `header.newChatIconPath`, `renameInput`, `textExtraction.*`, `theme.darkClass` |
| inert | ২০ | DeepSeek CSS-মডিউল হ্যাশ (`._46a12ab`, `.dc04ec1d`) বা DeepSeek মডেল-নামে কী করা (`modelMappings.*`, `embeddedPricing.*`) → arena DOM/মডেলে কখনও মেলবে না |
| neutral | ২৭ | ইঞ্জিন-নিজস্ব আচরণ: ফাইল আপলোড, এক্সপোর্ট, কোড-রান বাটন, autoFetch, themeWatcher… |
| **অশ্রেণীবদ্ধ** | **০** | একটিও না — নতুন লিফ যোগ হলেই (আপস্ট্রিম সিঙ্ক) টেস্ট লাল হবে এবং নাম ছাপাবে |

**ফাঁদ এড়ানো (এটা বড়):** "বন্ধ" করার জন্য খালি স্ট্রিং চলবে না — `querySelector('')` throw করে,
`classList.add/remove('')` throw করে, আর `text.includes('')` **সব** টেক্সটের সাথে মেলে
(অর্থাৎ একটির বদলে সব ড্রয়ার-আইটেম লুকিয়ে ফেলত)। তাই দুটি সেনটিনেল: `OFF = '.sds-off'`
(বৈধ CSS, কখনও রেন্ডার হয় না) ও `OFF_TEXT = '__sds_off__'`। ফেজ-১-এ ভুলবশত `''` দেওয়া
তিনটি মান (`dropdownMenu.optionLabel`, `android.hideGetAppText`, `hideDrawerAppItemText`)
এখন সেনটিনেল; `theme.lightClass` ওভাররাইড করা হয় না (খালি টোকেন DOMTokenList-এ ফাঁদ)।
টেস্ট দাবি করে: URL ছাড়া আর কোনো লিফ `''` হতে পারবে না।

**হার্ডকোড সাইট → প্রোফাইল-চালিত (১১টি প্যাচ, প্রতিটি অ্যাসার্টেড সিঙ্গল-ম্যাচ):**

| ফাইল | সাইট | এখন |
|---|---|---|
| `content.js` | longWork-এর "হোমে ফিরে গেছে" শনাক্তকরণ (২টি URL + `/chat/s/`) | `__sdUrl.atHome(e)` + `__sdUrl.session` |
| `content.js` | মেমরি-ইমপোর্টের পর রিলোড | `__sdUrl.home` |
| `content.js` | SDS এজেন্ট-গ্লু-এর ২টি "নিউ চ্যাট" নেভিগেশন | `__sdUrl.home` |
| `sd-native.js` | শেয়ার/নিউ-চ্যাটের পর হোমে যাওয়া | `__sdUrl.home` |
| `injected.js` | নেটওয়ার্ক-হুক পাথ — fetch র‍্যাপার (২), XHR র‍্যাপার (২), কনস্ট্যান্ট ব্লক (১), কমপ্লিশন-ডিটেক্টর (১) | `__sdApi.sessionFetch` / `historyMessages` / `completion` / `completionPaths` |

প্রতিটি প্যাচে DeepSeek-এর আসল লিটারেল **ফলব্যাক** (`||"…"`) হিসেবে আছে, তাই `sd-site.js`
ছাড়া স্টেজ হলেও আচরণ হুবহু আগের মতো। অ্যাঙ্কর-সংখ্যা টেস্টে পিন করা: `content.js`-এ
`__sdUrl` ১০টি, `sd-native.js`-এ ২টি, `injected.js`-এ `__sdApi` ১৬টি, এবং
`https://chat.deepseek.com/` লিটারেল ৫টি (১টি কনফিগ + ৪টি ফলব্যাক)।

**arena-র নতুন/বদলানো মান (এই ধাপে):**
- `selectors.modelSwitcher` → **OFF** : DeepSeek-এর `[role="radiogroup"]` arena-র মডেল-পিকারে
  ভুলভাবে মিলে যেত, আর তাকে DeepSeek মোড-সুইচার ভেবে চালানো হতো — এটাই ছিল সবচেয়ে বড়
  false-positive ঝুঁকি
- `selectors.fileInput` → `input[type="file"]` (superset; arena-র ইনপুট `[multiple]` না-ও হতে পারে — MODELLED)
- `modelDetection.attrMap.{vision,expert,deepthink,instant,chat}` → **OFF_TEXT** (ডীপ-মার্জ কী
  **মুছতে পারে না**, তাই খালি `attrMap: {}` ছিল নিষ্ফল — এটা ধরা পড়েছে)
- `api.sessionFetchPath` ও নতুন `api.historyMessagesPath` → `/messages`
  (VERIFIED এন্ডপয়েন্ট আকৃতি `GET /api/chat/{id}/messages`; সাবস্ট্রিং-ম্যাচ বলে টেইলটাই যথেষ্ট — MODELLED)
- `selectors.dropdownMenu.optionLabel` → OFF (ফাঁকা হলে `querySelector('')` throw করত)

**টেস্ট ও প্রমাণ:** নতুন `engine-arena-coverage.test.mjs` (৬টি টেস্ট) →
`npm run test:engine` **১২১/১২১** (ফেজ-২-এর পরে ছিল ১১৫) · `test:template` ২৮/২৮ ·
`sds-brand-check` pass · eslint clean · `node --check` চারটি ফাইলেই OK।

CI রান [`38219900405`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38219900405) —
সব জব ✅: Build & Verify APK (দুই ফ্লেভার) · **Engine harness** (নতুন `__sdUrl`/`__sdApi`
seam-এর পরেও DeepSeek আচরণ অপরিবর্তিত — এটাই শূন্য-রিগ্রেশনের রানটাইম প্রমাণ) ·
Emulator smoke API 30/34/35 · Lint (দুই ফ্লেভার) · Publish Release skipped।

**দ্বিতীয় অংশ — কম্পোজার-রাইট ও স্ক্রল-ম্যাথ (সম্পন্ন):**

- **আবিষ্কার:** ইঞ্জিনের প্রধান কম্পোজার-সেটার `OS()` ইতিমধ্যে prototype-এর নেটিভ `value`
  সেটার ব্যবহার করে, তাই React controlled ইনপুটেও চলে। কিন্তু মেমরি-ইমপোর্ট পাথ (`vxt()`)
  সরাসরি `i.value=t` করত → arena-তে React-এর স্টেট আপডেট হতো না, সেন্ড-বাটন নিষ্ক্রিয়ই থাকত।
- নতুন `sdsSetNativeValue(el, text)`: prototype সেটার + লেখার **আগে** React-এর `_valueTracker`
  খালি করা + contenteditable শাখা + অ-ফর্ম উপাদানে `false`। DeepSeek-ও একই পদ্ধতি ব্যবহার
  করে, তাই সেখানে আচরণের কোনো পরিবর্তন নেই।
- `sdAtEnd()` এখন reversal-aware: `flexDirection === "column-reverse"` হলে
  `below = q.bottom - r.bottom - scrollTop` (Chrome উল্টো কলামে `scrollTop ≤ 0` দেয়, ০ = সর্বশেষ),
  নইলে আগের সূত্র **অক্ষর-অবিকল** (টেস্টে মিলিয়ে দেখা হয়)। টেস্ট এটাও প্রমাণ করে যে পুরনো
  সূত্র arena-র "সর্বশেষ মেসেজ স্ক্রিনে আছে" অবস্থাকে "শেষ থেকে ৪২১০px দূরে" পড়ত →
  অটো-স্ক্রল আর এজেন্টের run-once গেট চুপচাপ বন্ধ হয়ে যেত।
- ২টি "কথোপকথনের ভেতরে আছি কি না" গেট (`location.href.includes("/chat/s/")`) এখন
  `__sdUrl.session` পড়ে (DeepSeek ফলব্যাকসহ) → `content.js`-এ `__sdUrl` রেফারেন্স ১০ → ১৪।
- নতুন `engine-composer-scroll.test.mjs` (৭টি টেস্ট): ফাংশন দুটোকে **বান্ডল থেকে তুলে** ফাঁকা
  DOM-এ চালানো হয় — স্ট্রিং-মিল নয়, আসল আচরণের প্রমাণ (নেটিভ সেটার কল হয়েছে, ট্র্যাকার
  খালি হয়েছে, own-property বসেনি; উল্টো/সোজা দুই কলামে স্ক্রল-গণনা)।
- গেট: `test:engine` **১২৮/১২৮** · `test:template` ২৮/২৮ · brand-check pass · eslint clean ·
  `node --check` OK।
- CI রান [`38243877118`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38243877118)
  — সব জব ✅: **Engine harness** (DeepSeek-এর কম্পোজার/সেন্ড/স্ক্রল পাথ অপরিবর্তিত — এই প্যাচের
  শূন্য-রিগ্রেশন প্রমাণ) · Build & Verify APK (দুই ফ্লেভার) · Emulator smoke API 30/34/35 ·
  Lint · Publish Release skipped।
- পরে §১৬/§১৭-এর দুই প্যাচের রানও সব-সবুজ: `38247355910` (§১৬) ও `38248360853` (§১৭)।

**নথিভুক্ত ঝুঁকি (এখনও ছোঁয়া হয়নি):** বান্ডলের নিজস্ব ৪টি `scrollTop=` অ্যাসাইনমেন্ট
(আপস্ট্রিম অটো-স্ক্রল) উল্টো কলামে কী আচরণ করে তা আসল ক্যাপচার ছাড়া বদলানো হয়নি —
ব্রাউজার সাধারণত উল্টো কলামে নতুন মেসেজ এলে নিজেই `scrollTop=0`-এ রাখে, তাই সম্ভাব্য প্রভাব
কম; তবু ফেজ-০ ক্যাপচারের পরে যাচাই করতে হবে।

**ফেজ-৩-এর বাকি অংশ / ফেজ-৪-এ যা যা আছে:**
1. React controlled-input (`_valueTracker` রিসেট) — arena-র textarea-তে টেক্সট বসাতে হলে দরকার
2. `ol.flex-col-reverse` স্ক্রল-ম্যাথ (DOM ক্রম উল্টো — এই রিপোতে আগেও এখানে বাগ #৭ ছিল)
3. হার্ড শর্ত ১: সাইডবার/অ্যাকাউন্ট-মেনু অ্যাঙ্কার + অ্যাডভান্সড-সেটিংস এন্ট্রির arena টুইন
4. হার্ড শর্ত ২: প্লাস-শিটের arena হিন্ট (`zvt()/Yvt()`) ও ফাইল-ইনপুট সংযোগ
5. SSE/`usage` ফ্রেম নেই → প্রাইসিং ও কনটেক্সট-গার্ড আনুমানিক থাকবে
6. ফেজ-০: আসল ক্যাপচার দিয়ে MODELLED মানগুলো যাচাই

---

## ১৬. ফেজ-৪ প্রথমাংশ — arena-তে "অ্যাডভান্সড সেটিংস" এন্ট্রি (হার্ড শর্ত ১) ✅

**সমস্যার আসল আকার:** DeepSeek-এ অ্যাডভান্সড সেটিংস ড্রয়ারে ঢোকার **একটাই** দরজা —
অ্যাকাউন্ট মেনুর রো (`WQ()`)। যাচাই করে দেখা গেছে bundle-এ `bds:open-drawer` ডিসপ্যাচ করে
শুধু ওই একটাই জায়গা, `bds:toggle-drawer`-এর কোনো ডিসপ্যাচার নেই, আর নেটিভ দিকে
(`MainActivity.kt` / `UiPolish.kt` / `PageActions.kt`) কোনো মেনু-আইটেমও নেই। অর্থাৎ arena-তে
মেনু-অ্যাঙ্কর না মিললে **সেটিংসে ঢোকার পথই থাকত না** — তাই ফলব্যাকটা ঐচ্ছিক নয়।

**যা করা হলো (content.js-এ ৪টি asserted রিপ্লেসমেন্ট, ৩,৩২৮,০৪০ → ৩,৩৩৩,৮৩৫ অক্ষর):**

| # | অ্যাঙ্কর | পরিবর্তন |
|---|---|---|
| ১ | `function WQ(e){var a;` | আগে ১২টি নতুন ফাংশন বসানো: `sdsIsArena / sdsIsBn / sdsAdvancedLabel / sdsArenaLabel / sdsIsSettingsText / sdsArenaRowText / sdsArenaItems / sdsArenaCloseMenu / sdsArenaMenu / sdsArenaMenus / sdsArenaRail / sdsArenaInstall` |
| ২ | `function WQ(e){var a;if(e.querySelector(` | `if(sdsIsArena()){sdsArenaMenu(e);return}` — arena শাখা প্রথমে, DeepSeek পাথ অপরিবর্তিত |
| ৩ | WQ-এর লেবেল-এক্সপ্রেশন (`const n=ur.locale==="bn"…?"Advanced Settings":r`) | `const n=sdsIsBn(),r=…,i=sdsAdvancedLabel(n,r),` — **লেবেল এখন একটাই জায়গায় তৈরি**, তাই DeepSeek ও arena রো কখনো আলাদা হতে পারে না |
| ৪ | `emt(),Lvt(),Y2t(),gge()` | `emt(),Lvt(),Y2t(),sdsArenaInstall(),gge()` — DeepSeek-এর ইনস্টলারের পাশে arena টুইন |

**আচরণ (সবই test-এ চালিয়ে প্রমাণ করা):**
- **matching:** arena মেনুতে `[role="menuitem"]` → না পেলে `button,a` → না পেলে মেনুর নিজের children
  (MODELLED, ফেজ-০-তে যাচাই)। লেবেল-ম্যাচ DeepSeek-এর মতোই `setting / preferences / সেটিংস /
  设置 / تنظیمات / настройк / ayar`। মেলে এমন আইটেমের **ঠিক পরে** রো বসে — অর্থাৎ এন্ট্রি
  "যেখানে আছে সেখানেই" থাকে।
- **রো:** ইঞ্জিনের নিজের `rw(label, V2t, …)` দিয়েই তৈরি ⇒ **একই লেবেল, একই আইকন, একই
  `bds:open-drawer` ইভেন্ট**; বাড়তি `bds-arena-menu-option` ক্লাস + `role="menuitem"`, আর
  ক্লিকে `document.body.click()` + Escape (React/Radix মেনু যেভাবে বন্ধ হয় — MODELLED)।
- **রাইল ফলব্যাক:** `#bds-settings-rail` — `#bds-root`-এর ভেতরে বসে (তাই `el.closest('#bds-root')`
  দেখে যেসব গার্ড "এটা আমাদের" বলে, সবগুলো স্বয়ংক্রিয়ভাবে এটাকেও আমাদের বলে ধরে), একই আইকন,
  `aria-label`/`title` একই লেবেল, ক্লিকে একই ইভেন্ট। প্রতিটি পাসে নিজেকে রি-চেক করে (হারালে
  ফিরে আসে), কখনো ডুপ্লিকেট হয় না।
- **শুধুমাত্র arena-তে:** `sdsIsArena()` false হলে (DeepSeek, বা `sd-site.js` না থাকলে)
  কোনো ফাংশন কিছু করে না — এমনকি একটি লিসেনারও রেজিস্টার করে না। টেস্ট এটা আলাদা করে প্রমাণ করে।
- **CSS:** `content.css`-এর শেষে একটি arena ব্লক (১১০,৩৯০ → ১১২,৫৫৬ অক্ষর) —
  arena-র নিজস্ব ভেরিয়েবল (`--text-primary`) আগে, ইঞ্জিনের টোকেন ফলব্যাক; `#bds-root`-এর
  stacking context-এ রাইলের z-index ছোট (৫) তাই ড্রয়ার খুললে তার ব্যাকড্রপই উপরে থাকে।
  ক্লাস নাম ইচ্ছাকৃতভাবে `OVERLAY` প্যাটার্ন এড়ায় (`bds-arena-rail`), নইলে `sd-sheets.js`-এর
  ব্যাক-জেশ্চার এটাকে "আঙুলের নিচে থাকা ওভারলে" ভাবত — টেস্টে ROOT_RE দিয়ে সেটা পিন করা।

**নতুন টেস্ট:** `android/app/src/test/js/engine-arena-settings-entry.test.mjs` — ১৩টি।
বান্ডলের **আসল** ফাংশনগুলো ভিএমে তুলে ফেক DOM-এ চালানো: DeepSeek-এর পুরনো পাথ (রো সাইটের
নিজের সেটিংস আইটেমের পরে, `rw`-এর ক্লাস, কোনো `role` অ্যাট্রিবিউট নেই), arena পাথ, ডুপ্লিকেশন
গার্ড, ফলব্যাক-চেইন, ভাষা-ম্যাচিং, রাইল, ওয়াচার (ক্লিক-পাস + MutationObserver + নেস্টেড মেনু),
"DeepSeek-এ কিছুই হয় না", CSS নিয়ম ও seam-কাউন্ট।

**ইচ্ছাকৃত সিদ্ধান্ত (পরিকল্পনা থেকে সামান্য সরে):** §৫.১-এ লেখা ছিল arena-র আইটেমের ভেতরের
মার্কআপ ক্লোন করে "দেখতে একই" করা। ক্যাপচার ছাড়া ক্লোন করা মানে React-এর reconciliation,
ডুপ্লিকেট `id`, আর অজানা সাব-স্ট্রাকচারের ঝুঁকি নেওয়া; তাই এন্ট্রিটা **ডিটারমিনিস্টিক
ইঞ্জিন-রো + নিজের CSS** দিয়ে বানানো হলো (MODELLED, ফেজ-০-তে arena-র আইটেমের ক্লাস/প্যাডিং
মিলিয়ে CSS টিউন করা হবে)।

**গেট:** `test:engine` **১৪১/১৪১** (আগে ১২৮, +১৩) · `test:template` ২৮/২৮ · brand-check pass ·
eslint clean · `node --check` OK।

**যা এখনো MODELLED (ফেজ-০-তে যাচাই):** arena-র মেনু কনটেইনার (`[role="menu"]`) ও আইটেম
(`[role="menuitem"]`); সেটিংস আইটেমের লেখা; রাইলের অবস্থান (left edge, ৫০% উচ্চতা) — যোগ্যতা
থাকলে arena-র আসল সাইডবারে ডক করা হবে।

**পরের অংশ (§১৭) — হার্ড শর্ত ২:** প্লাস-শিট (`$vt()`), যেখানে টেক্সটএরিয়া → ফাইল-ইনপুট →
কন্ট্রোল-রো খোঁজা হয়; arena-র জন্য এক্সপ্লিসিট `textarea[name="message"]` ও `zvt()/Yvt()`-তে
arena হিন্ট, কিন্তু `Lut` কম্পোনেন্ট ও `.bds-attach-*` ডিজাইন অপরিবর্তিত।

---

## ১৭. ফেজ-৪ দ্বিতীয়াংশ — arena-তে প্লাস (+) শিট (হার্ড শর্ত ২) ✅

**সমস্যার আসল আকার:** অ্যাটাচ-শিটটাই দাঁড়িয়ে আছে তিনটি DeepSeek-নির্দিষ্ট ধরে নেওয়ার ওপর —
(ক) কম্পোজার = `textarea#chat-input`, (খ) কন্ট্রোল-রো = যে রো-তে DeepThink বাটন আছে (`Rme()`),
(গ) সাইটের ফাইল-ইনপুট ওই রো-তেই বসে। arena-তে তিনটিই মিথ্যা, আর ব্যর্থতাটা **চুপচাপ**: ইঞ্জিন
হয় ভুল এলিমেন্টে টাইপ করত, নয় ভুল কনটেইনারে মাউন্ট করত, নয় `$vt()`-এর গোড়াতেই
`if(!e||!t){NQ(n,t);return}` ধরে ফিরে যেত মানে **কোনো + বাটনই দেখা যেত না**।

**সবচেয়ে বড় আবিষ্কার (একইসাথে সবচেয়ে বড় ঝুঁকি):** কম্পোজার-খোঁজার সেলেক্টর-তালিকাটা
বান্ডলে **দুবার** আছে — `_v()` (অফসেট ১,০৮৪,৬৩৫) আর `iT()` (২,৮৪৩,৭৮৩)। কিন্তু `_v()`-ই
আসল: `OS` (setComposer), `bCe` (send), `NW`, `OW`, `sdComposerText`, `Wu` — সবাই ওটাই ডাকে।
তালিকার ৫ নম্বরে আছে `textarea[placeholder]`, তার আগে `[role="textbox"]`; অর্থাৎ arena-র
সাইডবারে/প্যালেটে একটা `[role="textbox"]` থাকলেই ইঞ্জিন **সেখানে** লিখত। `'textarea[name="message"]'`
৩ নম্বরে যোগ করা হয়েছে (DeepSeek সেলেক্টর ১–২ আগেই ম্যাচ করে, তাই ওখানে কিছুই বদলায় না) —
দুটো তালিকাতেই, asserted ×২।

**যা করা হলো (content.js-এ ৭টি asserted রিপ্লেসমেন্ট, ৩,৩৩৩,৮৩৫ → ৩,৩৩৬,১৮৬ অক্ষর):**

| # | ফাংশন | পরিবর্তন |
|---|---|---|
| ১ | — | ৩টি নতুন হেল্পার: `sdsArenaComposer()` (প্রোফাইলের wrapper সেলেক্টর দিয়ে কম্পোজার থেকে কনটেইনার), `sdsArenaInComposer()`, `sdsArenaFileInput()` |
| ২ | `_v()` + `iT()` | `'textarea[name="message"]'` যোগ (×২ সাইট) |
| ৩ | `PQ()` | arena-তে কম্পোজারের ভেতরের ইনপুট আগে; না থাকলে আগের (শিপড) নিয়মই |
| ৪ | `Dme(e)` | arena-তে কনটেইনার কম্পোজার থেকে আসে, ইনপুট কোথায় থাকুক |
| ৫ | `V_()` | রেফারেন্স যদি কনটেইনারের সন্তান না হয় → `insertBefore` আর `NotFoundError` ছোড়ে না, অ্যাপেন্ড করে |
| ৬ | `Yvt(e)` | arena-তে কেবল কম্পোজারের ভেতরের বাটনই লুকানো হয় — arena-র নিজের + শিটের কার্ড নয় |
| ৭ | `$vt()` | arena-তে ফাইল-ইনপুট না থাকলেও শিট **মাউন্ট হয়** (`Lut` নিজেই পিক করার সময় `PQ()` দিয়ে ইনপুট খুঁজে নেয়, আর `Pvt()` DOM-পরিবর্তনে বারবার চলে) — DeepSeek-এর গোড়ার `return` অপরিবর্তিত |

**যাচাই করা ব্লাস্ট-রেডিয়াস:** `Dme`/`V_`/`Yvt` শুধুই `$vt`/`Qvt` থেকে ডাকা হয় (অর্থাৎ পুরো
প্রভাব অ্যাটাচ-ফ্লোতেই সীমাবদ্ধ); `zvt()` ইচ্ছাকৃতভাবে **অপরিবর্তিত** — সে DeepSeek-এর DeepThink
বাটন চেনে, arena-তে তার সঠিক উত্তরই "এমন বাটন নেই", ফলে `Rme()` null হয় আর কনটেইনার কম্পোজার
থেকে আসে। ফাংশন-স্কোপ acorn দিয়ে যাচাই করা: ইঞ্জিনের সব ফাংশন (আমাদের নতুন হেল্পারসহ) একটিই
`FunctionExpression` (অফসেট ৬২৯)-এর ভেতরে, তাই hoisting-এ অ্যাটাচ-ফ্লো থেকেও এরা দেখা যায়।

**নতুন টেস্ট:** `engine-arena-attach-sheet.test.mjs` — ৯টি। আসল ফাংশনগুলো ভিএমে তুলে
ফেক DOM-এ: ডেকয় `[role="textbox"]` থাকা সত্ত্বেও `_v()`/`iT()` আসল কম্পোজার ধরে;
DeepSeek-এ `#chat-input`-ই প্রথমে; arena-র ফাইল-ইনপুট কম্পোজারের (অ্যাভাটারের নয়);
কনটেইনার কম্পোজার থেকে; বিদেশি রেফারেন্সেও মাউন্ট ভাঙে না; সাইটের + লুকায় কিন্তু পপআপের
কার্ড লুকায় না; ইনপুট ছাড়াই শিট মাউন্ট হয় অথচ DeepSeek-এর আচরণ হুবহু আগের মতো।

**গেট:** `test:engine` **১৫০/১৫০** (আগে ১৪১, +৯) · `test:template` ২৮/২৮ · brand-check pass ·
eslint clean · `node --check` OK।

**যা এখনো MODELLED (ফেজ-০-তে যাচাই):**
1. arena-র ফাইল-ইনপুট কোথায় — কম্পোজারের `form`-এর ভেতরে থাকলে সাইটের + লুকানো হবে, নাহলে
   ইনপুটের জায়গা বদলাবে (টেস্টে এই ফলব্যাকটা আলাদা করে লেখা আছে: কম্পোজারে ইনপুট না থাকলে
   অ্যাভাটার-ইনপুটও জিতে যেতে পারে)।
2. `form`/`.bg-surface-raised` কনটেইনারটা সত্যিই একটা ফ্লেক্স-রো কি না — মাউন্ট `.bds-attach-menu-mount`
   `display:inline-flex`, তাই রো না হলে দেখতে অদ্ভুত লাগবে।
3. arena-র নিজের + কি ট্যাপে ইনপুট বানায় (তাহলে পিক করার মুহূর্তে `Lut`-এর লেজি রেজলভার সেটা পাবে)।

**CI প্রমাণ (ফেজ-৪):**
- §১৬ (সেটিংস এন্ট্রি) — রান [`38247355910`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38247355910)
  ✅ Engine harness · Build & Verify APK · Emulator smoke API 30/34/35 · Lint · Publish Release skipped।
- §১৭ (কম্পোজার + প্লাস-শিট) — রান [`38248360853`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38248360853)
  একইভাবে সব ✅ — হারনেস pass মানে DeepSeek-এর কম্পোজার-পাথ (টাইপ করা → পাঠানো), মেনু-ইনজেকশন
  ও অ্যাটাচ-ফ্লো আগের মতোই আছে; অর্থাৎ দুই হার্ড শর্তের কাজটা **শূন্য-রিগ্রেশনে** হয়েছে।

---

## ১৮. ফেজ-৩ শেষাংশ — কথোপকথনের মার্কার: শেষ `/chat/s/` সাইটগুলো ✅

ফেজ-৩-এর প্রথমাংশে ৯টি `/chat/s/` লিটারেলের মধ্যে কেবল "কথোপকথনে আছি কি না" গেট দুটো
site-aware করা হয়েছিল, চারটি সাইট অপরীক্ষিত রয়ে গিয়েছিল। ওগুলো এখন করা হলো — আর এগুলো
আসলেই গুরুত্বপূর্ণ ছিল, কারণ এরা **কথোপকথনের আইডি** বের করে:

| সাইট | ফাংশন | কেন গুরুত্বপূর্ণ |
|---|---|---|
| অফসেট ৯২২,১১৫ | `cS(e)` | সব per-chat কী-র ভিত্তি (ট্যাগ, টাইমস্ট্যাম্প, আপলোড, সেশন-স্টেট) |
| ৯২২,৩৩০ | `$6(e)` | সাইডবারের চ্যাট-লিংক খোঁজা (টাইটেল রিজলভ) |
| ৯২৪,৩৬৯ | `Bxe()` | একই কাজ — টাইটেল থেকে আইডি বের করে `j6(o,i)`-তে ঢোকায় |
| ৩,৩০৯,০৯৪ + ৩,৩০৯,২১৮ | `Y2t()`-এর মাউসডাউন হ্যান্ডলার | "এই ক্লিকটা কোন চ্যাটের?" — ট্যাগ/এক্সপোর্টের `tC` ভেরিয়েবল |
| ৩,৩৩১,৫৪৬-এর কাছের সাইট | `bds:urlChanged` হ্যান্ডলার | `yme(l)` — চ্যাট বদলালে per-chat স্টেট রিসেট |

arena-তে চ্যাট থাকে `/c/{id}`-তে, তাই ওখানে এই চারটিই **নীরবে কিছুই খুঁজে পেত না** — অর্থাৎ
ট্যাগ/টাইমস্ট্যাম্প/এক্সপোর্ট কোনো চ্যাটের সাথেই যুক্ত হতো না।

**যা করা হলো (content.js-এ ৭টি asserted রিপ্লেসমেন্ট, ৩,৩৩৬,১৮৬ → ৩,৩৩৭,৪১৪ অক্ষর):**

- দুটি নতুন হেল্পার: `sdsSessionId(url, deepseekSrc)` — arena-তে `__sdUrl.session` (মার্কার) ধরে
  indexOf দিয়ে আইডি কাটে (`?`, `#`, `/`-এ থামে); বাইরে-arena-তে **কলার-সাইটের নিজের DeepSeek
  প্যাটার্নটাই** `new RegExp(...)` করে চালায়, তাই DeepSeek बिल्कुल আগের রেজেক্স পায়
  (`cS`-এর কড়া `[a-f0-9-]+`, urlChanged-এর ঢিলা `[^/?#]+` — দুটোই আলাদাভাবে সংরক্ষিত)।
- `sdsChatLinkSel()` — `a[href*="<marker>"]`, চারটি কোড-সাইটে (তবে **কনফিগ লিটারেল
  `selectors.sidebar.chatLink`-এ নয়** — সেটা profile সারফেস, hardcode নয়)।
- regex-এর বদলে indexOf ব্যবহারের কারণ: মার্কার থেকে `new RegExp` বানাতে হলে `$`/`{`/`}` এস্কেপ
  করতে হতো, আর বান্ডলের মিনিফায়ার্ড কনটেক্সটে ওই ইস্কেপ-ক্লাস নিজেই ভাঙার ঝুঁকি — indexOf
  পদ্ধতি ছোট, দ্রুত, আর এস্কেপিং-এর প্রশ্নই নেই।

**নতুন টেস্ট:** `engine-arena-session.test.mjs` — ৯টি। ডুপ্লিকেট: DeepSeek-এ `cS` হুবহু
আগের মতো (hex-নয় এমন আইডি এখনো `null`!), arena-তে `?`/`#`/`/`-এ কাটা, খালি আইডি `null`,
নতুন-চ্যাট URL `null`, ক্রস-সাইট মিথস্ক্রিয়া `null`; `$6` দুই সাইটে সঠিক রো ধরে;
`sd-site.js` ছাড়া বিল্ডে DeepSeek ফলব্যাক; এবং একটি "বাকি সব `/chat/s/` হয় কনফিগ নয়
ফলব্যাক" প্রুফ (প্যাচ-কমেন্ট বাদ দিয়ে লাইন-বাই-লাইন স্ক্যান)।

**গেট:** `test:engine` **১৫৯/১৫৯** (আগে ১৫০, +৯) · `test:template` ২৮/২৮ · brand-check pass ·
eslint clean · `node --check` OK। পিন-আপডেট: `__sdUrl` ১৪ → ১৯ (দুই টেস্ট ফাইলে),
`sdsIsArena()`-এর গেট-পিন ≥১৩ (লোয়ার-বাউন্ড, কারণ এখন থেকে প্রতিটি নতুন শাখা সংখ্যা বাড়াবে)।

---

## ১৯. Arena Deck-এর নিজস্ব পরিচয়: লঞ্চার আইকন ও "অ-সম্পৃক্ত" বিজ্ঞপ্তি ✅

মালিকের সিদ্ধান্ত ৫ (নাম *Arena Deck*, `com.arenadeck.app`, "not affiliated with arena.ai"
ডিসক্লেইমার) এতদিন শুধু নাম ও `applicationId` পর্যন্ত পৌঁছেছিল; আইকন ছিল Super DeepSeek-এর
তিমি, আর ডিসক্লেইমার ছিল কেবল একটা XML কমেন্টে (§১২-র ঝুঁকি-তালিকায় "ইন-অ্যাপ নেই" বলে চিহ্নিত)।
দুটোই এখন বাস্তব।

### ক) লঞ্চার আইকন

**ডিজাইন:** তিনটি কার্ডের একটি ছোট "হাত" (ফ্যান), সামনের কার্ডে জ্যামিতিক "A" (Ace) — Super
DeepSeek-এর নেভি / সায়ান-নীল-ভায়োলেট প্যালেটেই, যাতে দুই অ্যাপ ভাইবোনের মতো লাগে কিন্তু
একটাকে আরেকটা বলে ভুল না হয় (ওটা তিমি, এটা কার্ড)। আর্টটা **মৌলিক** — arena.ai-এর লোগো/মার্ক
থেকে কিছুই নেওয়া হয়নি।

**দুটি কঠিন বাধ্যবাধকতা** (প্রথম খসড়ার আগেই কোড পড়ে বের করা):
1. **অ্যাডাপটিভ আইকন:** ১০৮dp ক্যানভাসের কেবল মাঝের ৬৬dp বৃত্ত *সব* লঞ্চার-মাস্কেই নিশ্চিত দৃশ্যমান;
   তাই প্রতিটি কার্ডের প্রতিটি কোণ ওই বৃত্তের ভেতরে ফিট করা হয়েছে (গ্লো বাইরে ছড়াতে পারে, কঠিন
   আর্ট নয়) — ফিটটা কোডে গণনা করা, চোখে আন্দাজ করা নয়।
2. **বুট-স্ক্রিন:** `BootScreenView` `app_icon.png`-কে `BitmapShader` দিয়ে একটা গোলাকার আয়তক্ষেত্রে
   (inset **৫.৮%**, radius **২১.২%**) ক্লিপ করে আঁকে। তাই ফাইলটা full-bleed, **অপাক** (opaque)
   বর্গ, যার নিয়ন-কিনারা ঠিক ওই আয়তক্ষেত্রের ওপর বসে; নিজের কোণ আঁকার চেষ্টা করলে ডবল-কোণ হতো।

**কীভাবে তৈরি:** `tools/icon/arena_deck_icon.py` (Pillow; শুধু ডেভেলপমেন্টে, বিল্ড এটা চালায় না)।
গোলাকার-আয়তক্ষেত্র কার্ডগুলো পলিগন হিসেবে একটা সাধারণ পিভটের চারপাশে ঘোরানো (ছবি ঘুরিয়ে নয়,
তাই অফসেট-ভুল হয় না), ৪× সুপারস্যাম্পল করে LANCZOS-এ নামানো; "A" **আঁকা** (ফন্ট নয়), তাই কোনো
ফন্ট কখনো শিপ-করা আর্ট বদলাতে পারে না। রান ~২.৩ সেকেন্ড; `--preview DIR` একটা কন্ট্যাক্ট-শিট
বানায় (সেফ-জোন, গোল/স্কুইর্কল মাস্ক, ৪৮px থাম্ব, বুট-ক্লিপ) — মানুষের যাচাইয়ের জন্য, শিপ হয় না।

**প্রথম খসড়া ব্যর্থ হয়েছিল — কেন:** কার্ডগুলো বামে সরে সেফ-জোনের বাইরে গিয়েছিল (কার্ডের x-অবস্থান
`pad` ধরে বসানো, কেন্দ্রে নয়), "A"-র ক্রসবার দেখা যায়নি, আর নীল-ওপর-নীল কনট্রাস্ট দুর্বল ছিল; তার ওপর
পিক্সেল-লুপে গ্রেডিয়েন্ট বানানোয় রেন্ডার লাগত **২ মিনিট ৩৫ সেকেন্ড**। সমাধান: জ্যামিতি কেন্দ্রীভূত
স্থানাঙ্কে নতুন করে লেখা, গ্রেডিয়েন্ট ১২৮×১২৮-এ বানিয়ে বাইলিনিয়ারে বড় করা (রৈখিক ঢাল বাইলিনিয়ারে
অক্ষত থাকে), "A" হালকা-সায়ান গ্রেডিয়েন্টে (কনট্রাস্ট)। এখন ২.৩ সেকেন্ড।

**ফাইল (সবই `android/app/src/arenaDeck/res/`-এ, নাম ধরে `main`-কে ওভাররাইড করে):**
`mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_foreground.png` (১০৮…৪৩২px, RGBA) ·
`drawable-nodpi/app_icon.png` (৫১২×৫১২, RGB opaque) · `values/colors.xml` (শুধু `launcher_background`
= `#0A1020`)। শেয়ার্ড `mipmap-anydpi/ic_launcher*.xml` ইতিমধ্যে ওই দুই নামেই ইঙ্গিত করে, তাই কোনো XML
নকল করা হয়নি; স্প্ল্যাশ/উইন্ডো প্যালেট (`bds_splash_bg`/`bds_window_bg`) **অপরিবর্তিত** — স্প্ল্যাশ থেকে
পেজে হ্যান্ড-অফ Super DeepSeek-এর মতোই।

### খ) "অ-সম্পৃক্ত" বিজ্ঞপ্তি (`IndependenceNotice`)

**ডিজাইন সিদ্ধান্ত:** একবারের ডায়ালগ, বুট-অ্যানিমেশন শেষ হওয়ার পর (পেজ তখন পুরো দৃশ্যমান)। **কেন
অ্যাডভান্সড সেটিংসে নয়:** হার্ড শর্ত ১ — ওখানে সেটিংস *ও তার UI ডিজাইন* অক্ষত রাখতে হবে; একটা নতুন
সারি যোগ করা ডিজাইন বদলানো হতো। ডায়ালগ কোনো বিদ্যমান UI ছোঁয় না।

**কেন ফ্লেভার সোর্স-সেট, `SiteProfile` ফ্ল্যাগ নয়:** টেক্সটটা শুধু arena ফ্লেভারের স্ট্রিং। `main`-এর কোড
সেটা `R.string` দিয়ে ধরলে (ক) Super DeepSeek ফ্লেভার কম্পাইলই হতো না, নয়তো (খ) `main`-এ একটা কপি
রেখে ছয়টা শেয়ার্ড লোকেলে অনুবাদ দিতে হতো (নইলে `MissingTranslation` লিন্ট) — আর `getIdentifier` দিয়ে
নাম ধরে রিসোর্স-শ্রিঙ্কার সেটা কেটে দিতে পারে। তাই: `src/arenaDeck/java/.../IndependenceNotice.kt`-এ আসল
কাজ, `src/deepseek/java/.../IndependenceNotice.kt`-এ একই নামের **no-op** (`= Unit`), আর শেয়ার্ড
`MainActivity` দুই ফ্লেভারেই কম্পাইল হয়। Super DeepSeek-এ কোনো ডায়ালগ/প্রেফারেন্স/স্ট্রিং নেই
(টেস্টে নিষিদ্ধ-শব্দ তালিকা দিয়ে পিন করা) — তার আচরণ হুবহু আগের মতো (মালিকের "ফ্রোজেন" সিদ্ধান্ত)।

**আচরণ:** `setCancelable(false)` (স্পষ্ট স্বীকৃতি লাগে) · "দেখা হয়েছে" রেকর্ড হয় **ডিসমিস-লিসনারে**, শো-এর
সময়ে নয় (উইন্ডোসহ প্রসেস মরলে পরের লঞ্চে আবার আসে) · `showing` গার্ড (দুই কলার, একটাই ডায়ালগ) ·
`isFinishing/isDestroyed` গার্ড · পুরোটা `runCatching`-এ (ডায়ালগ ব্যর্থ হলে লঞ্চ ভাঙে না, পরের বার চেষ্টা)।
হুক দুটি: `view.onExitFinished`-এর শেষে, আর ওভারলে-ছাড়া `dismissBoot()` পথে।

**টেক্সট:** ইংরেজি + নিচে বাংলা লাইন, `translatable="false"` (আইনি বিবৃতি; ছয় ভাষায় বিকৃত না হয়ে
হুবহু যায়)। বলে: স্বতন্ত্র/অনানুষ্ঠানিক; arena.ai-এর সাথে সম্পৃক্ত/অনুমোদিত/পৃষ্ঠপোষকতাপ্রাপ্ত নয়;
ব্যবহারকারী arena.ai-এর নিজস্ব ওয়েবসাইট তাদেরই শর্ত ও গোপনীয়তা নীতিতে ব্যবহার করছেন। README-তে
FAQ + লাইসেন্স-লাইনে একই বিবৃতি যোগ হয়েছে (দুই অ্যাপের জন্যই — Super DeepSeek-এ ইন-অ্যাপ নয়, শুধু ডক)।

### গ) যাচাই

- **নতুন টেস্ট `engine-arena-flavor.test.mjs` — ১১টি:** ওভাররাইড-সেট হুবহু এই ৮টি ফাইল (নতুন কিছু ঢুকলে
  টেস্ট ভাঙে, ইচ্ছাকৃতভাবে); প্রতি ঘনত্বের মাপ ও আলফা (ফোরগ্রাউন্ড RGBA, বুট-আইকন RGB opaque —
  PNG IHDR পড়ে); `colors.xml` শুধু `launcher_background` ডিফাইন করে (কমেন্ট বাদ দিয়ে); শেয়ার্ড অ্যাডাপটিভ
  XML এখনো ওই দুই নামে ইঙ্গিত করে (নইলে ওভাররাইড মরে যেত); জেনারেটর ও XML-এর রং একই; স্ট্রিংগুলো
  ঠিক ৫টি, সব `translatable="false"`; বিজ্ঞপ্তি-টেক্সটে "not affiliated with, endorsed by or sponsored
  by arena.ai" + বাংলা লাইন + "official app" দাবি নেই; দুই ফ্লেভারের API একই; Super DeepSeek-এরটা
  সত্যিই no-op; Arena-র টা একবার/নো-ন্যাগ/ক্র্যাশ-প্রুফ; `MainActivity`-তে ঠিক দুটি কল ও অন্য কোনো
  ফাইলে নেই।
- **Super DeepSeek অক্ষত:** `git diff 6f1b949 -- android/app/src/main/res` **খালি** (শেয়ার্ড রিসোর্স
  বেসের সাথে বাইট-অভিন্ন)।
- **গেট:** `test:engine` **১৭০/১৭০** (আগে ১৫৯, +১১) · `test:template` ২৮/২৮ · brand-check pass ·
  eslint ০ এরর (১টি পুরোনো ওয়ার্নিং `sd-agent.test.mjs`-এ, আমার ফাইলে নয়)।
- **Kotlin কম্পাইল-প্রমাণ (CI):** লোকালি কম্পাইল করা যায়নি (JDK/Android SDK নেই) — ব্রেস/প্যারেন-ব্যালান্স
  ও `git`-ডেল্টা হাতে মেলানো হয়েছিল; আসল প্রমাণ রান
  [`38299665108`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38299665108)
  (কমিট `43906ab`) — **সব ✅**: Run Android Unit Tests (`testDeepseekDebugUnitTest` +
  `testArenaDeckDebugUnitTest`) · Build Android Release APK (`assembleDeepseekRelease` +
  `assembleArenaDeckRelease`, মানে দুই ফ্লেভারেই `IndependenceNotice` কম্পাইল ও রিসোর্স মার্জ ঠিক) ·
  Verify APK Signature · Upload Arena Deck APK Artifact (৭.০ MB) · Emulator smoke API 30/34/35 (SD ফ্লেভারে
  no-op নোটিস সহ) · Engine harness · Lint। (আগের রান `38298035025` = `b53601f`, §১৮, সব ✅।)
- ⚠️ **APK-র ভেতরে আইকন সত্যিই ঢুকেছে কি না নামিয়ে দেখা যায়নি:** আর্টিফ্যাক্ট-ডাউনলোড হোস্ট
  (`*.blob.core.windows.net`) এই স্যান্ডবক্সের অ্যালাউলিস্টের বাইরে। প্রমাণ এখন Gradle-এর নাম-ভিত্তিক
  রিসোর্স-মার্জের নিয়ম + সবুজ বিল্ড; ডিভাইসে প্রথম ইনস্টলেই চোখে দেখা যাবে (খোলা-বিষয় ঘ-১)।

### ঘ) এখনো খোলা

1. আইকন আসল ডিভাইসের লঞ্চার-মাস্কে কেমন দেখায় — এখানে শুধু সিমুলেটেড প্রিভিউ (গোল/স্কুইর্কল/৪৮px)।
2. বিজ্ঞপ্তির ডায়ালগ থিম (`android.app.AlertDialog`, বিদ্যমান আপডেট-ডায়ালগের মতোই) আসল ডিভাইসে।
3. বিজ্ঞপ্তি শুধু প্রথম লঞ্চে; পরে আবার দেখার কোনো স্থায়ী জায়গা নেই (অ্যাডভান্সড সেটিংসে নয়, কারণ
   হার্ড শর্ত ১)। মালিক চাইলে ভবিষ্যতে অ্যান্ড্রয়েডের "App info" বর্ণনা বা বুট-স্ক্রিনের ফুটনোট ভাবা যায়।

---

## ২০. ফেজ-৫ প্রথমাংশ — হেলথ-চেক arena-সচেতন: মিথ্যা সতর্কতা বন্ধ ✅

**সমস্যা (হিসাব করে বের করা — ফেজ-৫-এর এক্সিট শর্ত "`sd-health.js` arena ল্যান্ডমার্ক সবুজ")।**
`sd-health.js` শুধু DeepSeek-এর কন্ট্রাক্ট দেখত: `textarea#chat-input`, `div.ds-message._63c77b1`,
`.ds-markdown`, `a[href*="/chat/s/"]`। arena-য় (প্যাচের আগে) যা ঘটত, ধাপে ধাপে:

1. composer — প্রাইমারি/স্ট্রং সিলেক্টর মেলে না; কেবল জেনেরিক ফলব্যাক `textarea[placeholder]`-এ মেলে →
   অবস্থা **`degraded`** (নন-অ্যাডভাইজরি ⇒ `failed`)।
2. send — `probeSend()` যেকোনো বাটনের `aria-label`-এ `/send|পাঠ/i` খোঁজে; arena-র `Send message` মেলে →
   `sendOk` → **`visible = true`** ("চ্যাট দৃশ্যমান" ধরে নেয়)।
3. `!ok && visible` ⇒ `showNotice()`: **"DeepSeek updated their page, so the message box may be paused in
   Super DeepSeek until the next update."** — প্রতিটি arena চ্যাট-পেজে, ভুল ব্র্যান্ডসহ; ✕ চাপলে ৪ সেকেন্ড পর
   আবার (সর্বোচ্চ ৮ বার, কারণ `old`-গার্ড কেবল *বিদ্যমান* এলিমেন্ট ঠেকায়)।

অর্থাৎ Arena Deck-এর প্রতিটি ব্যবহারকারী প্রথম মিনিটেই একটা ভুল "সাইট আপডেট হয়েছে" ব্যানার দেখত।
(`sd-site.js`-এর মন্তব্য ফেজ-২ থেকেই বলছিল "Phase 3 shows the health notice there" — কিন্তু কেউ
বাস্তবায়ন করেনি।)

**সমাধান — ডিজাইনের চারটি সিদ্ধান্ত:**
- **একক সোর্স:** arena-র কন্ট্রাক্ট আসে ইঞ্জিনের নিজের প্রোফাইল থেকে (`__sdSite.profile.selectors.*`,
  `urlPatterns.chatSession`) — হেলথ-চেক তাই এমন সিলেক্টর দেখতে পারে না যা ইঞ্জিন ছেড়ে দিয়েছে। প্রোফাইল
  না থাকলে নিরাপদ ডিফল্ট। `__sdSite.id === 'arena'` ছাড়া আর কিছুই শাখা বদলায় না (অজানা হোস্ট, `sd-site.js`
  ছাড়া বিল্ড, `'arena-ish'` — সবাই DeepSeek কন্ট্রাক্টে, টেস্টে পিন করা)।
- **শুধু যা ছাড়া ইঞ্জিন চলে না, সেটাই নোটিস তোলে:** `composer` ও `messages` কঠোর; `send`, `roles`,
  `sidebar` **advisory** (রিপোর্ট হয়, নোটিস তোলে না)। কারণ — এগুলো MODELLED, আর: খালি বক্সে পাঠানো-বাটন
  নাও থাকতে পারে; ইউজারের প্রথম বার্তার পর assistant-সারি এখনও আসেনি; সাইন-ইন পেজে "Send …" লেবেলের বাটন
  থাকতে পারে।
- **"চ্যাট দৃশ্যমান" প্রমাণ:** arena-য় শুধু একটি send-বাটন যথেষ্ট নয় (`sendProvesChat:false`); লাগে স্ট্রং
  composer (প্রোফাইলের প্রাইমারি সিলেক্টর) অথবা কথোপকথন। কথোপকথন = **URL-এ `/c/` আছে** *এবং* মেসেজ-
  কন্টেন্ট আছে — কারণ leaderboard-এর মতো অন্য arena পেজও `.prose` ব্যবহার করে, সেগুলোকে "মেসেজ হারানো চ্যাট"
  ভাবা চলবে না।
- **ব্র্যান্ড:** arena-য় নোটিস বলে "arena.ai may have changed its page, so … may be paused in **Arena Deck** until
  the next update. Your chat keeps working." (+ বাংলা)। "DeepSeek"/"Super DeepSeek" কখনোই নয় (টেস্টে পিন)।

**DeepSeek অপরিবর্তিত — প্রমাণ:** বিদ্যমান ৯টি `sd-health` টেস্ট এক অক্ষরও না বদলে সবুজ; নতুন টেস্ট
DeepSeek-এর আইডি, সিলেক্টর-তালিকা (`['div.ds-message._63c77b1','div.ds-message']`, `['._4f9bf79._43c05b5',
'._9663006','.ds-markdown']` …) ও ইংরেজি/বাংলা নোটিস-টেক্সট **হুবহু** পিন করে; আর "প্যাচের আগের মিথ্যা
অ্যালার্ম" টেস্টটা একই DOM-এ দেখায় arena-য় `visible:false`, DeepSeek-এ `visible:true`।

**টেস্ট — `engine-arena-health.test.mjs`, ১৫টি** (আসল `sd-site.js` + আসল `sd-health.js` একই vm-এ, ইনজেকশন-
ক্রমে): কন্ট্রাক্ট প্রোফাইল-থেকে-আসা ও কোনো `ds-`/`chat-input`/`/chat/s/` নেই; প্রোফাইল বদলালে চেক অনুসরণ করে;
সুস্থ কথোপকথন ও নতুন Direct Chat পেজ (`messages`/`roles` = n/a) নোটিসহীন; সাইন-ইন পেজ (এমনকি "Send magic
link" বাটন থাকলেও) ও leaderboard নোটিসহীন; কথোপকথনে আসল ড্রিফট (মেসেজ-সারি/composer হারালে) রিপোর্ট হয় ও
ব্র্যান্ড ঠিক; advisory তিনটি নোটিস তোলে না; বাংলা টেক্সট; DeepSeek হুবহু; প্রোফাইল-হীন arena শাখা সহনশীল।

**গেট:** `test:engine` **১৮৫/১৮৫** (আগে ১৭০, +১৫) · `test:template` ২৮/২৮ · brand-check pass · eslint ০ এরর।
**CI:** রান [`38300467615`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38300467615) (কমিট `7ff74d3`) — সব ✅
(Engine harness · Build & Verify APK দুই ফ্লেভার · Emulator smoke API 30/34/35 · Lint)।

**ইচ্ছাকৃতভাবে না-বদলানো পুরোনো আচরণ (স্কোপ-বাইরে আবিষ্কার, §১১-এর নিয়মে):** ✕-এ ডিসমিসের পর পরের
৪-সেকেন্ড চেকে নোটিস আবার আসে (মন্তব্য বলছে "shown once per session", কোড তা করে না)। DeepSeek-এর আচরণ
"বদলানো যাবে না" নিয়মে এটা ছোঁয়া হয়নি; মালিক চাইলে এক লাইনের ফ্ল্যাগে ঠিক করা যায়।

**যা এখনো MODELLED (ফেজ-০-তে যাচাই):** `textarea[name="message"]` ও `main ol.flex-col-reverse > *` আসলেই
Direct Chat-এ আছে কি না; কথোপকথন-URL সত্যিই `/c/{id}` কি না; খালি বক্সে arena-র পাঠানো-বাটন থাকে কি না;
সাইন-ইন পেজের গঠন। **Battle/Side-by-side-এর জন্য "এই মোড সমর্থিত নয়" নোটিস বাস্তবায়িত হয়নি** — arena-র
Battle URL-এর আকার অজানা (ফেজ-০), শুধু side-by-side-এর `/{cat}/side-by-side` জানা।

---

## ২১. ফেজ-৫ দ্বিতীয়াংশ — Direct Chat-এর আসল রিকোয়েস্ট: ইনজেকশন এবার সত্যিই পৌঁছায় ✅ (একটা ভুল মডেল সংশোধনসহ)

### ক) আবিষ্কার — এবং আমার নিজের পরিকল্পনার ভুল

`sd-agent.js`-এ সেশন-আইডি রেজেক্স খুঁজতে গিয়ে টোকেন/হিস্ট্রি পাইপলাইন পড়তে হলো, আর সেখানে ধরা পড়ল যে
**arena-য় ইঞ্জিনের সিস্টেম-প্রম্পট ইনজেকশন আসলে কিছুই করছিল না।** কারণগুলো, প্রমাণসহ:

1. **ভুল এন্ডপয়েন্ট-মডেল।** §২.২ ও §৭.২ arena-র বডি ধরেছিল `message.parts[]` — ওটা **Agent মোডের**
   `create-chat` (পাবলিক `api_map.json`-এর chunk-নাম `…agent_page…`, query-key `latest-workspace`,
   ত্রুটি-বার্তা "agentic session")। **Direct Chat** (মালিকের বেছে-নেওয়া মোড) যায় ক্লাসিক *evaluation*
   এন্ডপয়েন্টে: প্রথম পালা `POST /nextjs-api/stream/create-evaluation`, পরের প্রতিটি
   `POST /nextjs-api/stream/post-to-evaluation/{id}`।
2. **ফলাফল (ক):** প্রোফাইলের `chatCompletionPaths`-এ Direct Chat-এর প্রথম-পালার এন্ডপয়েন্টই ছিল না।
3. **ফলাফল (খ) — গুরুতর:** `injected.js`-এর রিরাইটার `I()` কেবল `prompt` স্ট্রিং ও `messages[]` চেনে। arena-র
   বডি (`userMessage.content`) কোনোটাই নয় ⇒ কোনো অনুরোধই বদলায়নি ⇒ **সিস্টেম-প্রম্পট, মেমরি, স্কিল,
   টুল-ট্যাগ নির্দেশনা, Deep Research কিছুই মডেলে পৌঁছাত না।** UI সবই দেখাত, কিন্তু হাই-ফিচারগুলো (Deep
   Research, Linux স্যান্ডবক্স) arena-য় আসলে **নিষ্ক্রিয়** ছিল — মডেল জানতই না টুল-ট্যাগ কী।
4. **ফলাফল (গ):** `/messages` হুক Agent মোডের ইতিহাসের; Direct Chat-এর নয়। সাবস্ট্রিং-ম্যাচ হওয়ায়
   `stop/{id}/messages/{id}`-এর মতো সম্পর্কহীন URL-ও "সেশন/হিস্ট্রি রেসপন্স" ভেবে ক্লোন ও পার্স হতো।
5. **ফলাফল (ঘ):** ইঞ্জিনের নিজের হিস্ট্রি-ফেচ (`bds:request-history-msgs`) DeepSeek-টেমপ্লেটে বানানো URL-এ
   (`/messages?chat_session_id=…`) ব্যবহারকারীর ক্রেডেনশিয়ালসহ রিকোয়েস্ট পাঠাত। ডিফল্টে সেটিংগুলো
   (`showTimestamps`, `loadAllHistoryOnSession`) বন্ধ, তাই কেউ চালু না করলে যেত না — কিন্তু চালু করলে
   যেত, এবং নীরবে ব্যর্থ হতো।

(`sd-agent.js`-এর `exactArgs()`-ও এই হিস্ট্রির ওপর নির্ভর করে, কিন্তু তার `sessionId()` রেজেক্স শুধু `/chat/s/` ধরে —
arena-য় সবসময় `null` ⇒ ৫ সেকেন্ডের টাইমআউট নয়, সরাসরি DOM-আর্গুমেন্টে ফেরে। সেটা **ইচ্ছাকৃতভাবে না
ছোঁয়া**: শুধু `sessionId()` ঠিক করলে প্রতিটি টুল-কলে ৫ সেকেন্ড অপেক্ষা ঢুকত, কারণ arena-র হিস্ট্রি-শেপ
অজানা। `engine-arena-session.test.mjs`-এর শেষ দুটি টেস্ট এটা পিন করে।)

### খ) প্রমাণ — তিনটি স্বতন্ত্র, চালু তৃতীয়-পক্ষ ক্লায়েন্ট

| সোর্স | কী দেখায় |
|---|---|
| `xtekky/gpt4free` → `g4f/Provider/needs_auth/Arena.py` | `create-evaluation` ও `post-to-evaluation/{id}` — **একই বডি**, শুধু URL আলাদা; স্ট্রিম-লাইন `a0:` / `ag:` / `ad:` |
| `OwlusMain/arena_watcher` → `arena_direct_client.py` | প্রথম-পালার ডিফল্ট টেমপ্লেট; `content-type: text/plain;charset=UTF-8`; রেফারার `arena.ai/c/{evaluationId}` (⇒ URL-এর আইডি = ক্লায়েন্ট-জেনারেটেড evaluation id ✓) |
| `diegosouzapw/OmniRoute` → `open-sse/executors/lmarena.ts` | একই বডি; পুরো কথোপকথন এক `userMessage.content`-এ চ্যাপ্টা (শুধু প্রথম-পালা ব্যবহার করে) |

```json
{ "id": "<evaluationId>", "mode": "direct-battle", "modelAId": "<uuid>",
  "userMessageId": "<uuid>", "modelAMessageId": "<uuid>",
  "userMessage": { "content": "<স্ট্রিং>", "experimental_attachments": [], "metadata": {} },
  "modality": "chat", "recaptchaV3Token": "<পেজ-মিন্ট করা>" }
```
রেসপন্স: **AI-SDK ডেটা-স্ট্রিম লাইন** (`a0:"টেক্সট"`, `ag:"রিজনিং"`, `ad:{"finishReason":…,"usage":…}`) —
`data: {json}` SSE নয়। (আগের ঝুঁকি-তালিকার "SSE-তে `usage` নেই" উক্তি Agent মোডের জন্য ছিল; Direct Chat-এর
`ad:` ফ্রেমে `usage` আছে। টোকেন-প্রাইসিং arena-য় বন্ধ থাকায় এখনো কাজে লাগানো হয়নি।)

### গ) কী করা হলো

| ফাইল | পরিবর্তন |
|---|---|
| `sd-site.js` (`VERSION` ২→৩) | arena `chatCompletionPaths` = `create-evaluation` + `post-to-evaluation/` (`create-chat` বাদ — Agent মোড সমর্থিত নয়); নতুন `firstTurnPath`; `sessionFetchPath`/`historyMessagesPath` = `__sds_off__` (কোনো URL-এ থাকতে পারে না); নতুন `explicitHistory:false`; `__sdApi`-তে `firstTurn` ও `explicitHistory` |
| `injected.js` (৯টি asserted প্যাচ, +১,৭৭৬ অক্ষর) | `I(e,t,first)`-এ arena শাখা — DeepSeek-এর `prompt` শাখার হুবহু অনুরূপ: একই ইনজেকশন-ফ্রিকোয়েন্সি নিয়ম (`first`/`always`/`every_x`), কথোপকথন-আইডি = `e.id`, প্রথম-পালা = `create-evaluation` URL, শুধু `userMessage.content` বদলায়; ইনপুট-সীমার ছাঁটাই; `bds:mutation-applied` ইভেন্ট। `Re()`: প্রথম-পালার ফ্ল্যাগ পাস, এবং arena-য় পেজের নিজের `content-type` (`text/plain`) **অক্ষত** (DeepSeek-এ আগের মতোই `application/json`)। XHR-যমজেও একই। ইতিহাস-ফেচ হ্যান্ডলারে `explicitHistory===false` হলে সঙ্গে সঙ্গে ফেরা |

অচেনা আকার (`message.parts[]`, `content` স্ট্রিং নয়, JSON নয়, কিংবা ইনজেক্ট করার কিছু নেই) — **বাইটে-বাইটে অক্ষত**,
পুনঃসিরিয়ালাইজই হয় না। `stop`, `rerun`, `resample`, `retry-evaluation-…` কখনো রিরাইট হয় না।

### ঘ) DeepSeek অপরিবর্তিত — গোল্ডেন প্রমাণ

প্যাচের **আগে** শিপ-করা `injected.js`-কে একটা vm-এ আসল `sd-site.js`-এর সাথে চালিয়ে ছয়টি DeepSeek দৃশ্যের আউটপুট
(বডি, হেডার, ক্রেডেনশিয়ালস) ধরা হয়; প্যাচের পরে `cmp` — **বাইট-অভিন্ন**। সেই ছয়টি এখন স্থায়ী টেস্ট:
প্রথম বার্তা · ফলো-আপ (শুধু মেমরি) · `always` · `messages[]` · charset-সহ `content-type` → `application/json` ·
অ-completion URL। আর "DeepSeek arena-আকারের বডি কখনো রিরাইট করে না" ও "DeepSeek-এর হিস্ট্রি-ফেচ আগের মতোই,
ক্রেডেনশিয়ালসহ" পিন করা।

### ঙ) টেস্ট — `engine-injected-payload.test.mjs`, ২৫টি

আসল `sd-site.js` + আসল `injected.js` একই vm-এ, ইনজেকশন-ক্রমে; পেজের নিজের `fetch` রেকর্ডার — সার্ভার আসলে যা পেত
সেটাই পরীক্ষা। DeepSeek গোল্ডেন ×৬ + ১; arena: প্রথম পালায় সিস্টেম-প্রম্পট ও মেমরি · কী/কী-ক্রম অক্ষত, টোকেন অক্ষত ·
হেডার/ক্রেডেনশিয়ালস অক্ষত · ফলো-আপে সিস্টেম-প্রম্পট নেই · `always` · `every_x` (প্রতি কথোপকথনের নিজস্ব গণনা,
দুই কথোপকথন আলাদা) · পুরোনো ব্লক-সহ পেস্ট করা টেক্সট ছেঁকে নেওয়া · `bds:mutation-applied` · দীর্ঘ বার্তা ছাঁটাই ·
ইনজেক্ট করার কিছু না থাকলে বাইট-অভিন্ন · অচেনা আকার ×৪ · অ-Direct-Chat URL ×৬ · সম্পর্কহীন `/messages` রেসপন্স
ক্লোন/পার্স হয় না · হিস্ট্রি-ফেচ বন্ধ · `__sdApi` পৃষ্ঠ।

**গেট:** `test:engine` **২১২/২১২** (আগে ১৮৫, +২৫ ও `sd-agent`-এর ২টি পিন-টেস্ট) · `test:template` ২৮/২৮ · brand-check pass · eslint ০ এরর।
**CI:** রান [`38301869595`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38301869595) (কমিট `53969f5`) ও
[`38301972000`](https://github.com/themuhammad-personal/Super-Deepseek-/actions/runs/38301972000) (কমিট `26e6fc9`) — দুটোই সব ✅,
**Engine harness-সহ** (হেডলেস ক্রোমে DeepSeek-এর বাস্তব ফিক্সচার: কম্পোজার → সেন্ড → রিরাইট-করা রিকোয়েস্ট — DeepSeek-এর পথ
অপরিবর্তিত থাকার ইন-ব্রাউজার প্রমাণ, vm-গোল্ডেনের পাশাপাশি)।
(পিন হালনাগাদ: `__sdApi` সংখ্যা ১৬→২০; `sd-site.js` `VERSION` ৩; arena completion-paths; DeepSeek-এর `__sdApi`-তে দুটি
নিষ্ক্রিয় নতুন কী।)

### চ) ⚠️ মালিকের জানা দরকার — প্রাইভেসি ও শর্ত (ইনজেকশন চালু হওয়ার সরাসরি পরিণতি)

1. **আপনার মেমরি/স্কিল/সিস্টেম-প্রম্পট এখন প্রতিটি নতুন কথোপকথনের প্রথম বার্তার সাথে arena-য় যায়** — এবং
   Direct Chat-এ আপনার বেছে-নেওয়া মডেলের **তৃতীয়-পক্ষ প্রদানকারীর** কাছে। DeepSeek-এ শুধু DeepSeek পেত; এখানে
   প্রদানকারী বদলায়। মেমরিতে ব্যক্তিগত তথ্য থাকলে তা বাইরে যায়। নিয়ন্ত্রণ আছে: `disableMemory` /
   `disableSystemPrompt` সেটিং (বিদ্যমান, অপরিবর্তিত)।
2. **arena-র নিজস্ব শর্ত:** arena ব্যবহারকারীর প্রম্পট গবেষণা/মূল্যায়নে ব্যবহার করতে পারে (তাদের নিজেরাই বলে ব্যক্তিগত
   তথ্য শেয়ার না করতে)। ইনজেক্ট-করা টেক্সটও ওই বার্তারই অংশ হয়ে তাদের সার্ভারে সংরক্ষিত হয়।
3. **ইতিহাসে দৃশ্যমানতা:** সংরক্ষিত বার্তায় `<SuperDeepSeek>…` ব্লক থাকে; পেজ রিলোড/ইতিহাস খুললে সেটা বার্তার ওপর
   দেখা যেতে পারে। ইঞ্জিনের "ইনজেক্টেড টেক্সট লুকানো" অংশ DeepSeek-এর DOM-ক্লাসের ওপর নির্ভরশীল — arena-র জন্য
   অযাচাইকৃত (ফেজ-০)।
4. এটা Arena Deck-এর "অ-সম্পৃক্ত" বিজ্ঞপ্তি (§১৯)-র পরিপূরক: বিজ্ঞপ্তিতে সম্ভবত এই তথ্যও যোগ করা উচিত — মালিকের
   সিদ্ধান্ত চাই (এখন বিজ্ঞপ্তি শুধু "স্বতন্ত্র/অনুমোদিত নয়" বলে)।

### ছ) এখনো MODELLED (ফেজ-০-তে যাচাই)

বডির প্রতিটি কী ও `mode:"direct-battle"`/`modality:"chat"` মান ২০২৬-এর তৃতীয়-পক্ষ কোড থেকে — আসল ক্যাপচারে মেলাতে
হবে (বিশেষত পেজ নিজে যা পাঠায়, ও ফলো-আপের বডি); Direct Chat কথোপকথন *লোড* করে কোন এন্ডপয়েন্টে/শেপে
(তাই `explicitHistory` বন্ধ, `exactArgs` DOM-ফলব্যাকে); ইনজেক্টেড-টেক্সট লুকানোর DOM; স্ট্রিম-লাইন প্রোটোকলের কোন
অংশ ইঞ্জিনের স্ট্রিমিং-শনাক্তকরণ কাজে লাগাতে পারে।

---

## ২২. চূড়ান্ত দফা — আসল রানটাইম প্রমাণ, আরও দুটি ভুল-ধারণা সংশোধন, নিরাপত্তা-অডিট

### ক) Arena Deck এবার সত্যিই চালানো হয় — CI-র আসল Android এমুলেটরে

আগে কেউ Arena Deck **চালায়নি**: বিল্ড কম্পাইল হতো, ইঞ্জিন নকল-DOM-এ টেস্ট হতো, কিন্তু কোনো এমুলেটরে APK চলত না
(ওয়ার্কফ্লো-র মন্তব্য বলছিল "ইঞ্জিন এখনো অভিযোজিত নয়, তাই স্মোক অর্থহীন" — ফেজ-২-র যুক্তি, পরে অচল)। এখন
`android/ci/emulator-smoke.sh` `FLAVOR=Deepseek|ArenaDeck` নেয় (SD: API 30/34/35 — **জবের নাম অবিকল আগের মতো**, যাতে
কোনো required-check না ভাঙে; Arena Deck: API 34), এবং যাচাই করে:

| যাচাই | কীভাবে | ফল (রান `38366065860` → `38378574915`) |
|---|---|---|
| APK-র ভেতরে প্যাকেজ, লেবেল, লঞ্চার, **ছয়টি আইকন পিক্সেল-বাই-পিক্সেল**, অন্য অ্যাপের আইকন অনুপস্থিত | `apk_check.py` (`aapt dump badging` + Pillow দিয়ে PNG ডিকোড তুলনা) | ✅ `com.arenadeck.app` · "Arena Deck" · `com.superdeepseek.app.MainActivity` |
| প্রথম লঞ্চে বিজ্ঞপ্তি আসে, OK-তে বন্ধ হয়, **দ্বিতীয় লঞ্চে আসে না** (`seen` টিকে থাকে) | `uiautomator` ডাম্প + `input tap` | ✅ |
| অ্যাপ arena.ai খোলে — **কখনো chat.deepseek.com নয়** | লগে `Official WebView loaded: <url>` | ✅ |
| ক্র্যাশ/ANR নেই; ইঞ্জিন প্রস্তুত (১৮ সেকেন্ডের ক্যাপ ছাড়াই), `injected.js` শেষ, পেজ-কনসোলে ইঞ্জিনের ত্রুটি নেই | লগ-মার্কার (`Engine UI ready`, `Launch screen cap reached`…) | ✅ `ready=yes cap=no injected=yes` |
| Super DeepSeek-এ বিজ্ঞপ্তি আসে **না** (আচরণ ফ্রোজেন) | একই ডাম্প | ✅ |

স্ক্রিপ্টের প্রতিটি শাখা (বিজ্ঞপ্তি নেই / ফিরে এসেছে / OK-তে যায়নি / ক্র্যাশ / মৃত প্রসেস / ভুল সাইট / UI পড়া যায় না) একটি
**নকল `adb`**-এর বিরুদ্ধে আসল স্ক্রিপ্ট চালিয়ে টেস্ট করা (`engine-arena-ci.test.mjs`, ৩৩টি) — কারণ CI-র লগ এখান থেকে পড়া
যায় না, আর একটি ভুলে ১৫ মিনিট নষ্ট। মূল ফলাফল পাঠানোর জন্য স্ক্রিপ্ট `::notice::` annotation ছাড়ে (জব-লগ নয়) —
সেগুলো `gh api …/check-runs/<job>/annotations` দিয়ে পড়া যায়। (GitHub-এর সীমা: প্রতি annotation ~৪ KB, প্রতি স্টেপে দশটি —
আমার প্রথম চেষ্টায় ৪৫ KB-র চাংক কেটে গিয়েছিল; এখন ≤৩.৬ KB চাংক, আলাদা স্টেপে, দরকারে পেলোড ধাপে ধাপে ছোট করে।)

**একটি ফ্লেক:** রান `38375953166`-এ Super DeepSeek-এর API-34 স্মোক `crash or ANR`-এ ব্যর্থ; পরের রানে (কোনো SD-কোড না বদলে)
সবুজ। ধীর CI-এমুলেটরে ANR-ফ্লেক বলে ধরা হয়েছে; এখন থেকে ক্র্যাশের অংশবিশেষ annotation-এ আসে, পুনরাবৃত্তি হলে বিশ্লেষণযোগ্য।

### খ) আরও দুটি ভুল-ধারণা — আমারই, কোড পড়ে ধরা পড়ল

1. **"`features.*` ফ্ল্যাগ দিয়ে DeepSeek-সেবা বন্ধ" — ভুল।** বান্ডলে কেবল `features.attachMenu.*` ও
   `features.fileUpload.imagesEnabled` **পড়া হয়**; `statusMonitor`, `tokenPriceDisplay`, `apiPlayground`,
   `whatsNewPopup`, `sidebar.*` ইত্যাদি কোনো কোড পড়েই না। তাই ফেজ-৩.১-র "L3 বন্ধ" ওভাররাইডগুলো কার্যত প্রসাধনী; আসলে
   যা কিছু বন্ধ, তা বন্ধ DOM-অ্যাংকরের অনুপস্থিতিতে (হ্যাশ-ক্লাস মেলে না) অথবা নিচের গার্ডে।
2. **"`statusUrl: ''` মানে স্ট্যাটাস-উইজেট বন্ধ" — ভুল।** `b1e()` শুধু *অ-খালি* URL ফেরত দেয়, নইলে বিল্ট-ইন
   `status.deepseek.com`-এ ফেরে; আর `S1e()` (স্ট্যাটাস-মনিটর) বুট-চেইনে **নিঃশর্তে** ডাকা হয় — arena-য় প্রতিটি পেজ-লোডে
   (ও পর্যায়ক্রমে) DeepSeek-এর স্ট্যাটাস আনত, আর DeepSeek-এ ঘটনা থাকলে "ds-status-banner" দেখানোর উপাদান তৈরি হতো।
   একইভাবে প্রাইসিং-লোডার `LH = {official: "https://api-docs.deepseek.com/…"}` **হার্ডকোড ধ্রুবক** (কনফিগ নয়), তাই
   `api.pricing: ''` কিছুই করেনি — প্রতিটি arena পেজ-লোডে নেটিভ-ব্রিজ দিয়ে DeepSeek-এর প্রাইসিং-ডক আনত।

   **সমাধান:** দুই শুরু-বিন্দুতে `sdsIsArena()` গার্ড (`S1e` এর প্রথম লাইন; বুটের `ext().then` → `(sdsIsArena()?
   Promise.resolve(null):ext()).then`) — DeepSeek অপরিবর্তিত। `engine-arena-services.test.mjs` (৭টি): `S1e`-কে vm-এ তুলে
   arena-য় `fetch`/লিসেনার ০, DeepSeek-এ ১/১; গার্ড তুললে ঠিক সংশ্লিষ্ট তিনটি টেস্ট ভাঙে (প্রমাণ); **`content.js`-এর প্রতিটি
   `deepseek.com` URL গুনে-শ্রেণিবদ্ধ** (সাতটি URL, নির্দিষ্ট সংখ্যা) — ভবিষ্যৎ বান্ডল-সিঙ্কে নতুন কোনো DeepSeek-URL ঢুকলে
   টেস্ট জোরে ভাঙবে, ব্যবহারকারীর ফোনে নয়। প্রোফাইলের মন্তব্যও সত্যে ফেরানো হয়েছে।

### গ) নিরাপত্তা পুনঃ-অডিট (ফেজ-৬-র প্রধান অংশ)

| বিষয় | পাওয়া গেল | ব্যবস্থা |
|---|---|---|
| **ব্রিজ-ট্রাস্ট** | ২২টি `@JavascriptInterface` মেথডের প্রতিটি `if (!trustedPage) return` দিয়ে শুরু; `trustedPage` **মূল-ফ্রেমের** URL-কে সাইট-প্রোফাইলের *হুবহু-হোস্ট* (`arena.ai`/`www.arena.ai`) তালিকার সাথে মিলিয়ে ঠিক হয়; ফরেন iframe (reCAPTCHA, OAuth) ট্রাস্ট দিতেও পারে না, কাড়তেও পারে না | কোনো পরিবর্তন লাগেনি। **অপরিবর্তিত সীমাবদ্ধতা (DeepSeek-এও আছে):** অ্যান্ড্রয়েড ব্রিজ-অবজেক্ট সব ফ্রেমে ঢোকায়, তাই বিশ্বস্ত পেজে এম্বেড-করা তৃতীয়-পক্ষ iframe তাত্ত্বিকভাবে কল করতে পারে; arena-য় সেটা Google-এর reCAPTCHA — আর `NetworkGuard`-এর অ্যালাউলিস্ট অপরিবর্তিত |
| **টোকেন-স্নিফার** (`injected.js`) | `h()` `localStorage`-এর `/token\|auth\|session/i` কী থেকে, আর `authorization` হেডার (fetch/XHR) থেকে বেয়ারার টোকেন তোলে; ব্যবহার **একটিই** জায়গায় — নিজের ইতিহাস-ফেচে `Authorization: Bearer`. `content.js` টোকেন পড়েই না (`Authorization` শুধু API-প্লেগ্রাউন্ডের curl-টেমপ্লেট) | arena কুকি-সেশন ব্যবহার করে (`arena-auth-prod-v1` কুকি, OmniRoute-র কোডে)। **শক্তিবৃদ্ধি:** arena-য় ইঞ্জিন কোনো ক্রেডেনশিয়াল *পড়েই না, রাখেই না* (`authToken: sdsArenaPage()?null:h()` ও `setAuthToken`-এ গার্ড) — ভবিষ্যতে ইতিহাস-এন্ডপয়েন্ট চালু হলেও বেয়ারার যেতে পারবে না। টেস্ট (গার্ড ছাড়া ব্যর্থ — প্রমাণিত): স্টোরেজে JWT + পেজের পাঠানো হেডার কোনোটাই `Authorization`-এ আসে না; DeepSeek-এর টোকেন-খোঁজ অপরিবর্তিত |
| **ইতিহাস-ফেচ** | DeepSeek-টেমপ্লেটে বানানো URL-এ (`/messages?chat_session_id=`) ব্যবহারকারীর ক্রেডেনশিয়ালসহ রিকোয়েস্ট (ডিফল্টে বন্ধ সেটিংয়ের পেছনে) | §২১-এ বন্ধ (`explicitHistory:false`) |
| **DeepSeek-সেবায় কল** | স্ট্যাটাস-মনিটর ও প্রাইসিং-ফেচ arena-য় চলছিল | §২২-খ-তে গার্ড |
| **`NEXT_LOCALE` কুকি** | ইঞ্জিনের ভাষা-বদলানো `NEXT_LOCALE` কুকি *লেখে* — এটা arena-র নিজস্ব next-intl কুকি (পাথ-সেগমেন্ট `[locale]` চাঙ্ক-নামে দেখা) | DeepSeek-এও একই আচরণ, তাই অপরিবর্তিত; **ডিভাইসে যাচাইযোগ্য:** ইঞ্জিনের ভাষা বদলালে arena-র ভাষাও বদলায় কি না |
| **ডেটা-প্রবাহ** | সিস্টেম-প্রম্পট/মেমরি/স্কিল প্রথম বার্তার সাথে arena ও মডেল-প্রদানকারীর কাছে (§২১-চ) | বিজ্ঞপ্তিতে এখন স্পষ্ট বলা আছে (নিচে) |

### ঘ) বিজ্ঞপ্তি এখন ডেটা-প্রবাহও বলে

মালিক প্রশ্নগুলো এড়িয়ে যাওয়ায় আমি **আচরণ বদলাইনি** (মেমরি/প্রম্পট আগের মতোই যায়) — শুধু প্রকাশ বাড়িয়েছি, কারণ সেটা রক্ষণশীল ও ফেরতযোগ্য:
"প্রতিটি কথোপকথনের প্রথম বার্তার সাথে Super DeepSeek-এর বিল্ট-ইন নির্দেশনা ও আপনার সংরক্ষিত মেমরি/স্কিল/ক্যারেক্টার/প্রজেক্ট
arena.ai ও আপনার বেছে-নেওয়া মডেলের প্রদানকারীর কাছে যায়; বন্ধ করতে Advanced settings-এ **"Disable Hidden System Prompt"** ও
**"Disable Stored Memory Injection"** চালু করুন" (ইংরেজি + বাংলা)। টগলের নাম দুটো ইঞ্জিনের আসল লেবেলের সাথে **টেস্টে পিন করা**
(`content.js`-এ `"disableSystemPrompt":"Disable Hidden System Prompt"` ইত্যাদি) — বিজ্ঞপ্তি বাস্তব থেকে সরে গেলে টেস্ট ভাঙে।
**মালিকের সিদ্ধান্ত এখনো খোলা:** arena-য় এগুলো ডিফল্টে বন্ধ হবে কি না (§২১-চ)।

### ঙ) ক্যাপচার-কিট (`tools/arena-capture/`)

arena.ai-র পেজ-*কাঠামো* রেকর্ড করার স্ক্রিপ্ট — কনসোল বা ফোনের বুকমার্কলেট; বাংলা নির্দেশিকা `README-BN.md`। গোপনীয়তা প্রতিশ্রুতি
**টেস্টে প্রমাণিত**: বার্তার লেখা, চ্যাট-শিরোনাম, আপনার নাম, ইমেইল, টোকেন, কুকি, আইডি কখনো রপ্তানিতে যায় না। টেক্সটের তিন স্তর —
`free` (পপআপ/কম্পোজার: UI-লেবেল দরকারি), `safe` (সাইডবার/হেডার: শুধু পরিচিত UI-শব্দ, বাকি `<label len=N>`), `none` (বার্তার সারি);
রপ্তানিতে ইমেইল/JWT/বেয়ারার/UUID/লম্বা-অস্পষ্ট-স্ট্রিং আবার ছাঁকা ও গোনা; ঐচ্ছিক `redact:[আপনার নাম]`। (নির্মাণকালে নিজের
ত্রুটি ধরা পড়ে: টোকেন-*সংখ্যা* (`promptTokens`) ভুলে `<redacted>` হচ্ছিল — অথচ `usage`-এর আকারটাই জানতে চাই; এখন শুধু ব্যক্তিগত/গোপন
*সংখ্যা* (phone, pin…) লুকানো হয়।)

### চ) ফেজ-৫-এর বাকি আইটেম — কোডে নয়, প্রমাণে নিষ্পত্তি

| আইটেম | সিদ্ধান্ত | প্রমাণ |
|---|---|---|
| ইতিহাস / রিনেম / সার্চ-এর "API পুনর্নির্দেশ" | **দরকার নেই** — ইঞ্জিন সাইটের কোনো API নিজে ডাকেই না | `content.js`-এ `/api/v0` কেবল `PH`-কনফিগ-ডিফল্ট; আপেক্ষিক-URL `fetch` ০; ইতিহাস-ফেচ একমাত্র (`injected.js`) ও বন্ধ। বাকি শুধু DOM-সিলেক্টর (হ্যাশ-ক্লাস), যা লগ-ইন-করা ক্যাপচার-নির্ভর |
| `?model_a=` থেকে মডেল-শনাক্তি | **এখন কোড লাগবে না** — ভোক্তা নেই | ব্যাজ-সিলেক্টর INERT, প্রাইসিং-টেবিল DeepSeek-কী-র, লিমিট এক (১২৮,০০০); শনাক্ত-করা নাম কেউ খায় না। ক্যাপচারের পর ব্যাজ চাইলে |
| **শুধু Direct Chat** | বাস্তবায়িত: `injected.js` `mode:"battle"`/`"side-by-side"`-বডি **কখনো ছোঁয় না**; Direct-এর নাম (`direct-battle`), অনুপস্থিত বা অদেখা নাম ইনজেক্ট করে (নাম বদলালেও নীরবে বন্ধ হবে না) | টেস্ট |
| Battle/Side-by-side-এর "সমর্থিত নয়" নোটিস | **বাকি** — তবে URL এখন জানা: Battle `/text`, Side-by-side `/text/side-by-side`, Agent `/agent`, Direct `/text/direct` (আসল পেজের RSC-প্রিফেচ থেকে); মোড সুইচ মোবাইলে নেটিভ `<select>` | §২৩ |
| ইন-অ্যাপ আপডেট চ্যানেল | **ইচ্ছাকৃতভাবে বন্ধ** — Arena Deck APK রিলিজে প্রকাশ করতে রিলিজ-পাইপলাইন বদলাতে হয় (মালিকের সিদ্ধান্ত) | `Site.selfUpdateEnabled=false` |
| "নিষ্ক্রিয় কিন্তু দৃশ্যমান" সেটিং (হার্ড শর্ত ১: ড্রয়ার অক্ষত) | নিচের তালিকা | কোড-পাঠ (ডিভাইসে চালানো নয়) |

**নিষ্ক্রিয়-কিন্তু-দৃশ্যমান (কোড-পাঠে প্রমাণিত, arena-য় চালিয়ে নয়):** সাইডবার ট্যাগ/রিনেম/সার্চ/ট্যাগ-হাইডার (হ্যাশ-করা সাইডবার-সিলেক্টর
— আসল পেজে `nav`/`header` লগড-আউট মোবাইলে নেই); হেডার-শিরোনাম/লোগো, মডেল-ব্যাজ, প্রাইস-ইনসার্শন, কোড-ব্লক-ব্যানার, প্রিভিউ-প্যানেল
(INERT সিলেক্টর); টোকেন-প্রাইস ডিসপ্লে (arena-র `ad:` ফ্রেমে `usage` আছে কিন্তু ইঞ্জিন `data: {json}` ছাড়া পার্স করে না);
**Show timestamps** ও **Load all history on session** (ইতিহাস-ফেচ বন্ধ); টুল-আর্গুমেন্টের সঠিক-মান পুনরুদ্ধার (`sessionId()` শুধু `/chat/s/`);
মডেল-ম্যাপিং/প্রাইসিং (DeepSeek-কী)। **DOM/API-নিরপেক্ষ বলে কোড-পাঠে মনে হয় (চালিয়ে দেখা হয়নি):** এক্সপোর্ট, কোড-রানার/চার্ট/ডক,
মেমরি/স্কিল/ক্যারেক্টার/প্রজেক্ট (ইনজেকশন §২১-এ ঠিক), MCP, ব্যাকআপ/ইমপোর্ট, ভাষা, লং-ওয়ার্ক, API-প্লেগ্রাউন্ড (ব্যবহারকারীর নিজের DeepSeek-কী
দিয়ে — arena-নিরপেক্ষ), সেটিংস-ড্রয়ার নিজে।

### ছ) গেট

`test:engine` **৩২৬/৩২৬** (ফেজ-৪ শেষে ১৫০; এই সেশনে +১৭৬) · `test:template` ২৮/২৮ · brand-check pass · eslint ০ এরর · পাইথন (`apk_check`) ১০/১০ ·
CI-তে কম্পাইল + দুই APK + চার এমুলেটর-জব সবুজ — সর্বশেষ রান `38381499285` (কমিট `0b14c6f`): Build & Verify APK, Lint, Engine harness, Super DeepSeek ×৩ (API 30/34/35)
ও Arena Deck (API 34) সব ✅।

---

## ২৩. আসল arena.ai থেকে প্রথম তথ্য — CI এমুলেটরের ভেতর থেকে (Phase 0, আংশিক)

**কীভাবে:** ডিবাগ-APK-র WebView-তে Chrome DevTools Protocol দিয়ে ঢুকে (`android/ci/cdp_probe.mjs`)। অবস্থা: **লগড-আউট/অ্যানোনিমাস**, `/text/direct`,
ভিউপোর্ট ৩২০×৬১৬, API 34। রান `38373189454` (প্রথম পূর্ণ ক্যাপচার, ৭৯ KB), `38375953166` (স্লট-ফিক্স যাচাই), `38378574915` (শিট-ক্যাপচার, ১৩৭ KB)।

### যা নিশ্চিত হলো (VERIFIED) — আর যা ভুল প্রমাণিত

| বিষয় | আসল পেজে | প্রোফাইলের আগের অবস্থা |
|---|---|---|
| কম্পোজার | `<textarea name="message" placeholder="Ask anything…">` একটি `<form>`-এর ভেতরে; `form` = কম্পোজার-বক্স | MODELLED → **VERIFIED** |
| সেন্ড-বাটন | `button[aria-label="Send message"][type=submit]`, খালি বক্সেও আছে | MODELLED → **VERIFIED** |
| ফাইল-ইনপুট | **একটি** `input[type=file].hidden`, কম্পোজারের *কলাম-div*-এর সন্তান (কন্ট্রোল-রো-র নয়) | MODELLED → **VERIFIED** |
| arena-র নিজের `+` | `button[aria-label="Add files"]` (কন্ট্রোল-রো-র বাম গ্রুপে, `data-slot="tooltip-trigger"`) | ❌ **ভুল ছিল:** arena-utils-এর `"Attach files"` — পেজ তা বলে না |
| মোড-সুইচ | `button[role=combobox]` + লুকানো `<select>`: **Battle / Agent / Side by Side / Direct** (মোবাইলে নেটিভ) | অজানা |
| হোম/URL | `/text/direct?model_a=…` (রিডাইরেক্ট), প্রিফেচ: `/text`, `/text/side-by-side`, `/agent` | VERIFIED (arena-utils ও মিলল) |
| থিম | `<html class="… light">` — `light`/`dark` ক্লাস; ইঞ্জিনের বিল্ট-ইন `lightClass: "light"` আসলেই ঠিক | MODELLED → **VERIFIED** (light); dark অদেখা |
| `#root-portal-target` | আসলে `<main class="h-full min-h-0">` | MODELLED (আইডি ঠিক, অবস্থান ভিন্ন) |
| লগড-আউট মোবাইলে সাইডবার/হেডার | `nav`, `header`, `a[href*="/c/"]` — **কিছুই নেই** (DOM-এ নেই) | অনুমান ছিল সাইডবার আছে → ইঞ্জিনের **স্থায়ী "Advanced Settings" রেল** (§১৬) তাই আসলে *একমাত্র* প্রবেশপথ এই অবস্থায় |
| ইঞ্জিন | `site=arena@v3`; `#bds-css`, `#bds-root`, `__sdHandleBack` আছে; রেল দৃশ্যমান `[8,290,36,36]` "Advanced Settings"; হেলথ-চেক `ok` — `composer:ok send:ok`, **কোনো মিথ্যা ব্যানার নেই** | — |
| নেটওয়ার্ক | পেজ-লোডে ৩৩–৫১ রিকোয়েস্ট: **`POST /nextjs-api/sign-up` ২০০ (অ্যানোনিমাস সেশন নিজে খোলে)**; PostHog `/rpc/…` প্রক্সি; **reCAPTCHA Enterprise** (`enterprise.js`, `anchor`, `reload`, `clr`); `GET /nextjs-api/autoeval/release-banner`; Next.js RSC-প্রিফেচ; Cloudflare `cdn-cgi/rum`; GTM/GA | নতুন |
| ওয়েব-নির্ভর হেডার | `/nextjs-api/*`-এ `x-arena-web-deployment`, `traceparent`… | নতুন |

### এই ক্যাপচার থেকে ধরা পড়া ও সারানো প্রোডাক্ট-ত্রুটি (হার্ড শর্ত ২)

**দুটি `+` পাশাপাশি, আর কম্পোজার ৩৪px লম্বা।** `Yvt()` সাইটের `+` চেনে "ফাইল-ইনপুটের ঠিক আগের ভাই" দিয়ে (DeepSeek-এর DOM); arena-য় ইনপুটের আগের ভাই
ইঞ্জিনেরই এলিমেন্ট, তাই arena-র `+` লুকানো হয়নি, আর ইঞ্জিনের `+` (রেফারেন্স ফর্মের সন্তান নয়) ফর্মের **একেবারে নিচে নিজস্ব সারিতে** বসেছিল
(কন্ট্রোল-রো `y=517`, ইঞ্জিনের `+` `y=549`)। DeepSeek-এ একটাই `+` — ইঞ্জিনেরটা সাইটেরটার জায়গায়।
**সমাধান** (`sdsArenaAttachSlot()` + তিনটি অ্যাসার্টেড সংযোগ): arena-র `Add files` (না মিললে মোড-সুইচের ঠিক আগের বোতাম — ভাষা বদলালে লেবেল বদলায়)
লুকিয়ে ইঞ্জিনের `+` তার গ্রুপে তার **আগে** বসানো; বাকি মাউন্ট (expand/rag) যেখানে ছিল সেখানেই। **আসল পেজে যাচাই (রান `38375953166`):**
`group=["div.bds-attach-menu-mount","button[Add files]","button{combobox}",…]`, `addFiles=display:none`, ফর্ম **১২২px → ৮৮px**।
`engine-arena-real-composer.test.mjs` (১২টি) এখন **আসল ক্যাপচার-করা গঠনেই** টেস্ট করে (মডেল-করা ফ্ল্যাট ফর্মে নয়)।

### ইঞ্জিনের `+`-শিট আসল arena.ai-তে (হার্ড শর্ত ২-র কার্ড) — রান `38378574915`

`div[role=dialog].bds-attach-dropdown` — বটম-শিট "**Add to chat**" (৩২০ প্রস্থে পুরো-প্রস্থ, `[0,76 320×540]`), ভেতরে:
দ্রুত-গ্রিড **Camera · Photos · Files**; "**More tools**": **Upload Folder · Attach Project · Deep Research (সুইচসহ) · GitHub Repo · Fetch Web Page**।
(`bds-attach-toggle` ক্লাস আসলে *Deep Research কার্ডের* — বোতামের নয়; বোতাম `bds-plus-btn`।) শিট খুলল **স্ক্রিপ্ট-`.click()`-এ**; প্রোবের আসল
পয়েন্টার-ক্লিক ব্যর্থ হলো কারণ `elementFromPoint` দেখাল পয়েন্টারের নিচে **ক্যাপচার-কিটের নিজস্ব প্যানেল** (`#sd-capture-panel`, নিচে-বামে ফিক্সড)
— প্রোবের নিজের বাধা, প্রোডাক্ট-ত্রুটি নয়। কিটে `__sdCaptureNoPanel` যোগ হয়েছে, আর **প্যানেল ছাড়া আসল পয়েন্টার-ক্লিকে শিট খুলল** (রান `38381499285`, কমিট `0b14c6f`:
`openedBy=real-click`, পয়েন্টারের নিচে `bds-plus-btn`-এর SVG `line`, `dropdown=1 backdrop=1 header=1 items=5`, স্লট অক্ষত) — অর্থাৎ হার্ড শর্ত ২
আসল arena.ai পেজে (লগড-আউট) শুরু থেকে শেষ কাজ করে।

### এখনো অজানা (লগ-ইন-করা অবস্থা ও কথোপকথন লাগবে — আপনার ক্যাপচার)

অ্যাকাউন্ট-মেনু ও সাইডবার (ডেস্কটপ-প্রস্থে); কথোপকথনের মেসেজ-তালিকা (`column-reverse`? `.prose`?); স্ট্রিমিংয়ের স্টপ-বোতাম;
`create-evaluation`/`post-to-evaluation`-এর আসল ইনজেক্টেড-রিকোয়েস্ট (আমাদের পেলোড-অ্যাডাপ্টার তৃতীয়-পক্ষের কোড থেকে — অ্যানোনিমাস সেশনে একটি *আসল বার্তা*
পাঠালে তা CI-তেই যাচাই হতো, কিন্তু প্রতি CI-রানে arena-র সার্ভারে স্বয়ংক্রিয় বার্তা পাঠানো ভদ্রতার সীমা পেরোয়, তাই মালিকের স্পষ্ট অনুমতি ছাড়া নয়);
ইঞ্জিনের ইনজেক্ট-করা টেক্সট ইতিহাসে দেখা যায় কি না; মোবাইল-স্ক্রিনে আসল আঙুলে `+`-শিটের আচরণ।
