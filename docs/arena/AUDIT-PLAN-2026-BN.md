# ArenaPilot — অডিট, গবেষণা ও স্থিতিশীলতা পরিকল্পনা (v2.0.1)

এই নথি **দাবি নয়, যাচাইকৃত তথ্য**। যেটা যাচাই করা যায়নি সেটা স্পষ্ট লেখা আছে।

## ১. অডিট — আসলে কী আছে

| বিষয় | বাস্তব অবস্থা |
|---|---|
| ধরন | `arena.ai` কে WebView-তে খুলে তার ওপর একটি **inject করা JS ইঞ্জিন** (পুরোনো better-deepseek থেকে আসা, ~৪০০০ লাইনের `content.js` সহ) এবং নেটিভ Kotlin শেল (~১৫ হাজার লাইন) |
| আর্কিটেকচার | MVVM/Clean নয় — একটি `MainActivity` (১৭৮২ লাইন) + `WebViewBridge` (২৩৫৮ লাইন)। UI আসলে arena-র নিজের পেজ, তাই "নেটিভ Compose UI" এখানে প্রযোজ্য নয় |
| CI (GitHub Actions) | ৭টি job: build+Kotlin unit tests, lint, emulator smoke (API 34), native sandbox (১২/১২), arena adapter, harness — সর্বশেষ run সবুজ |
| লোকাল JS টেস্ট | template ২৮/২৮ পাস; engine ৪২৫/৪২৬ (একটি ব্যর্থতা = Pillow ইনস্টল নেই, কোডের ত্রুটি নয়) |
| Lint | ০ error, ৩৩ warning (বেশিরভাগ `catch (e)` — ইচ্ছাকৃত best-effort idiom) |
| Lifecycle | `onRenderProcessGone` দুই WebView-তেই আছে, `onDestroy` WebView/handler পরিষ্কার করে — ঠিক আছে |

### খুঁজে পাওয়া সমস্যা (মূল কারণসহ)

| # | সমস্যা | মূল কারণ | অবস্থা |
|---|---|---|---|
| A1 | Share-intent ফাইল পড়া শেষে Activity নষ্ট হলে `evaluateJavascript` ডাকা হতো | background Thread → `runOnUiThread` এ `isDestroyed` চেক ছিল না (অন্য দুই জায়গায় ছিল) | **v2.0.1-এ ঠিক** |
| A2 | `flushPendingPageActions` destroyed WebView-তে চলতে পারত | একই | **ঠিক** |
| A3 | `allowBackup=true` — MCP key, সেশন ডেটা adb/cloud backup-এ যেতে পারত | ডিফল্ট থেকে যাওয়া | **ঠিক** (`false`) |
| A4 | version তিন জায়গায় (package.json, lock, gradle fallback) আলাদা হয়ে যাওয়ার ঝুঁকি → আপডেট চ্যানেল ভাঙে | হাতে সিঙ্ক | **ঠিক** — টেস্ট (`scripts/release-hygiene.test.mjs`) এখন drift ধরে |
| A5 | Lint noise ৩৩ → আসল warning চাপা পড়ে | `catch (e)` | **ঠিক** → ১৪ |
| B1 | রিলিজ keystore (`superdeepseek-release.jks`) রিপোতে commit করা, ডিফল্ট পাসওয়ার্ড `superdeepseek` | আদি সিদ্ধান্ত | **ঠিক করা হয়নি** — চাবি বদলালে বিদ্যমান ইনস্টলে আপডেট ভাঙবে। সিদ্ধান্ত মালিকের (নিচে §৪) |
| B2 | `cleartextTrafficPermitted=true` + user CA বিশ্বাস | LAN/localhost MCP সার্ভারের জন্য ইচ্ছাকৃত | রাখা হয়েছে, নথিভুক্ত। পরবর্তীতে per-domain করা যায় |
| B3 | R8/minify বন্ধ; `targetSdk 34` (Play Store-এর জন্য ৩৫ লাগবে) | সতর্কতা | **ঠিক করা হয়নি** — আসল ডিভাইসে পরীক্ষা ছাড়া minify চালু করা ঝুঁকিপূর্ণ; sideload-এ সমস্যা নেই |

### সবচেয়ে বড় সত্য (মূল কারণ "কিছুই ঠিকমতো কাজ করে না" অনুভূতির)

কোড ক্র্যাশ নয়, **arena.ai একটি তৃতীয় পক্ষের সাইট** যার DOM/API যেকোনো দিন বদলায়, আর সেটি Cloudflare + reCAPTCHA Enterprise দিয়ে সুরক্ষিত।
ইঞ্জিনের প্রতিটি ফিচার (composer খোঁজা, `create-evaluation` হুক, বার্তা পার্স) সেই DOM-এর ওপর নির্ভর করে। CI **anonymous** ও fixture-ভিত্তিক, তাই:

- লগইন করা অ্যাকাউন্টে পূর্ণ Direct Chat flow, আসল model-এর সঙ্গে tool loop, আসল arm64 ফোন — **এগুলো এখনো কোনো স্বয়ংক্রিয় পরীক্ষায় প্রমাণিত নয়** (STATUS-2026-11-12 §৩ এও লেখা)।
- আমি এই sandbox-এ Android SDK/JDK/Chromium চালাতে পারিনি; প্রমাণ এসেছে লোকাল Node টেস্ট + GitHub Actions থেকে।

## ২. গবেষণা (যাচাইকৃত)

- `https://arena.ai/text/direct` সরাসরি fetch করে দেখা: এখনো Next.js অ্যাপ (`modality=text`, `mode=direct`), reCAPTCHA Enterprise shim ও Cloudflare challenge আছে — `Site.kt`-এর `newChatUrl` সঠিক।
- একাধিক স্বাধীন ওপেন-সোর্স প্রজেক্ট (LMArenaBridge, arena2api, arena_watcher) নিশ্চিত করে: প্রথম turn `POST /nextjs-api/stream/create-evaluation` (`mode:"direct"`, `modelAId`, `userMessage`), পরের turn `post-to-evaluation/{id}`, SSE prefix `a0:` টেক্সট / `ag:` reasoning / `ad:` শেষ / `a3:` error। ইঞ্জিনের `sd-site.js` যে path ধরে তা এর সঙ্গে মেলে। এই API **অনানুষ্ঠানিক** — বদলালে `sd-health.js` drift notice দেখায়।

## ৩. পরিকল্পনা (অগ্রাধিকার অনুযায়ী)

| P | কাজ | অবস্থা |
|---|---|---|
| P0 | ক্র্যাশ/লাইফসাইকেল ফাঁক বন্ধ (A1, A2) | ✅ এই রিলিজে |
| P0 | ডেটা-গোপনীয়তা (A3) ও release hygiene গার্ড (A4) | ✅ |
| P0 | CI সবুজ + APK প্রকাশ ও যাচাই | নিচে §৫ |
| P1 | **আসল ডিভাইসে acceptance test**: লগইন → বার্তা → ছবি সংযুক্তি → sandbox `printf 42` → আপডেট চেক | ⏳ মালিকের ফোন দরকার; `window.__sdAgent.diagnose()` এর আউটপুট পাঠালে নির্দিষ্ট ভাঙা ফিচার ধরা যাবে |
| P1 | ফিচার ম্যাট্রিক্স: প্রতিটি দৃশ্যমান ফিচারের একটি করে পরীক্ষা | ⏳ |
| P2 | `MainActivity`/`WebViewBridge` ভাঙা (UpdateFlow, ShareIntake, PickerController আলাদা ক্লাস) | ⏳ — আচরণ-সংরক্ষণকারী রিফ্যাক্টর, ১৫০+ টেস্ট থাকায় নিরাপদ, কিন্তু বড় |
| P2 | R8 চালু + targetSdk 35 + Play Store প্রস্তুতি | ⏳ |
| P3 | MCP LAN-এর জন্য per-domain cleartext, keystore ঘোরানো (migration পরিকল্পনাসহ) | ⏳ |

## ৪. মালিকের সিদ্ধান্ত দরকার (আমি একা নিইনি)

1. **GitHub PAT ফাঁস**: টোকেনটি চ্যাটে প্রকাশ্যে লেখা হয়েছে। কাজ শেষে এটি **revoke** করে নতুন বানান।
2. **Keystore**: রিপোতে থাকা `.jks` ও ডিফল্ট পাসওয়ার্ড যে কেউ ব্যবহার করে আপনার নামে APK সই করতে পারে। নিরাপদ পথ: নতুন key বানিয়ে GitHub Secrets-এ রাখা — তবে এতে ব্যবহারকারীদের একবার আনইনস্টল-ইনস্টল করতে হবে।
