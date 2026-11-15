# ArenaPilot — পরিকল্পনা (v2.4.0)

> এই ফাইলটিই একমাত্র সক্রিয় পরিকল্পনা। আগের সব পরিকল্পনা ও রিপোর্ট মুছে ফেলা হয়েছে (git history-তে আছে)।
> কাজের চলমান অবস্থা: [PROGRESS.md](PROGRESS.md)। নতুন চ্যাটে কাজ ধরতে: [PROJECT-SETUP.html](PROJECT-SETUP.html)।

## ১. লক্ষ্য
arena.ai-এর **Direct Mode**-এর চারটি পেজ — Text, Code, Search, Image — এ ArenaPilot-এর ইঞ্জিন নেটিভভাবে বসে স্টেবল কাজ করবে।
Battle, Side-by-side ও Agent mode অফিসিয়াল অবস্থায় অপরিবর্তিত থাকবে। Direct Mode-এ মডেল নির্দিষ্ট করা যায়, তাই মডেলকে
সর্বোচ্চ এজেন্টিক ক্ষমতা দেওয়াই ডিজাইনের কেন্দ্র।

## ২. অডিট — যা এখন সত্য (২০২৬-১১-১৫, stabilize/v2.1.0 @ 47c487d)
| বিষয় | অবস্থা | প্রমাণ |
|---|---|---|
| সেটিংস ও "+" শিট ছাঁটাই (v2.2.0) | সম্পন্ন | `engine-scope-prune.test.mjs`, CI |
| চার Direct পেজ ইঞ্জিনে যুক্ত (v2.3.0) | সম্পন্ন (ইউনিট টেস্ট ও CI) | `engine-direct-modalities.test.mjs` |
| APK বিল্ড ও ইউনিট টেস্ট | সবুজ | Actions: `Build & Verify APK` |
| Emulator smoke | **লাল** (শেষ দুই রান) — দ্বিতীয় লঞ্চে সিস্টেম WebView sandbox process মেরে ফেলে (`reason=13`, `reason=12`); অ্যাপ নিজে ক্র্যাশ করেনি | exit-info annotation |
| পুরোনো প্ল্যান/রিপোর্ট ডক | ১১টি বাংলা ডক + অপ্রাসঙ্গিক `AGENTS.md`/brand-check (অন্য টেমপ্লেটের অবশেষ) | মুছে ফেলা হয়েছে |
| Direct Mode-এ সীমাবদ্ধতা | v2.1.0-এ stream পড়া, error recovery, কাটা reply-এর recovery যুক্ত | `sd-agent-recovery.test.mjs` |
| এজেন্টিক প্রম্পট | মৌলিক "plan → act → check" ছিল; persistence/verification/limit-handling ছিল না | `sd-site.js` |

## ৩. গবেষণা (official উৎস, যাচাইকৃত)
- OpenAI, *GPT-4.1 Prompting Guide* (cookbook.openai.com/examples/gpt4-1_prompting_guide): এজেন্টিক প্রম্পটে তিনটি রিমাইন্ডার —
  **persistence** (কাজ শেষ না হওয়া পর্যন্ত থামবে না), **tool-calling** (অনুমান নয়, টুল দিয়ে যাচাই), **planning** (কলের আগে-পরে ভাবা)।
- Anthropic, *Effective harnesses for long-running agents* (anthropic.com/engineering/effective-harnesses-for-long-running-agents):
  এক context window-এ কাজ শেষ না হলে **progress ফাইল + git history** হয়ে ওঠে এজেন্টের স্মৃতি; এক সময়ে একটি ফিচার, প্রতিটির পর যাচাই ও commit;
  কাজ "শেষ" ঘোষণার আগে সত্যিকারের পরীক্ষা।
- GitHub Actions `reactivecircus/android-emulator-runner`: `ram-size`, `heap-size`, `cores` ইনপুটে emulator-এর মেমরি বাড়ানো যায় —
  system-kill ফ্লেক কমানোর বৈধ উপায়।

## ৪. কী ঠিক হবে, কী নতুন, কী অপরিবর্তিত
- **নতুন লেখা:** এজেন্টিক প্লেবুক (সব মোডের প্রম্পটে), Code ও Search মোডের অতিরিক্ত নিয়ম।
- **ঠিক করা:** emulator job-এর স্থিরতা (RAM + সীমাবদ্ধ retry), রিপোজিটরি পরিষ্কার, README, সংস্করণ v2.4.0।
- **অপরিবর্তিত:** Image মোডে প্রম্পট ইনজেকশন বন্ধ (ছবির প্রম্পট দূষিত হয় না), Battle/Side-by-side/Agent পেজ।

## ৫. অগ্রাধিকার ও ধাপ
| # | কাজ | অবস্থা |
|---|---|---|
| P0 | পরিকল্পনা রিপোজিটরিতে লেখা, পুরোনো ডক মোছা | সম্পন্ন |
| P0 | এজেন্টিক প্লেবুক + টেস্ট (`engine-agent-playbook.test.mjs`) | সম্পন্ন |
| P1 | CI: emulator RAM বাড়ানো, দ্বিতীয় লঞ্চ retry সর্বোচ্চ ২ বার | সম্পন্ন |
| P1 | v2.4.0 সংস্করণ বাম্প (package.json, lock, gradle fallback) | সম্পন্ন |
| P1 | push → Actions সবুজ → main-এ merge → Release APK | PROGRESS.md দেখুন |
| P2 | README পুনর্লিখন (পরিচয় ও কাজ) | সম্পন্ন |
| P2 | HTML রিপোর্ট ও প্রজেক্ট সেটআপ গাইড | সম্পন্ন |

## ৬. আর্কিটেকচার (সংক্ষেপে)
- `android/app/src/main/java/com/arenadeck/app/` — Kotlin শেল: `MainActivity` (WebView), `WebViewBridge` (JS↔Kotlin), `Sandbox*` (proot Linux sandbox, ফরগ্রাউন্ড সার্ভিস),
  `NetworkGuard`, `UpdateChecker`, `Studio*` (Linux Studio)।
- `android/app/src/main/bds-assets/bds/` — ইঞ্জিন: `content.js` (UI, সেটিংস, MCP, মেমরি, প্রজেক্ট), `injected.js` (অনুরোধ রূপান্তর), `sd-site.js` (arena সাইট প্রোফাইল, মডালিটি, প্রম্পট),
  `sd-agent.js` (এজেন্ট লুপ ও recovery), `sd-health.js`, `sd-native.js`, `sd-sheets.js`।
- `android/app/src/test/` — Kotlin (Robolectric) ও Node (`*.test.mjs`) টেস্ট; `android/ci/` — emulator smoke।

## ৭. সৎ সীমাবদ্ধতা
- লগইন করা সত্যিকারের ফোনে Code/Search/Image মোডের end-to-end পরীক্ষা এখানে সম্ভব নয় (arena sign-in ও reCAPTCHA টোকেন শুধু পেজ তৈরি করতে পারে)।
- প্রম্পট উন্নতি মডেলের আচরণ বদলায় কিন্তু নিশ্চয়তা দেয় না; সংশ্লিষ্ট টেস্ট শুধু প্রম্পট ঠিকমতো যাচ্ছে কিনা প্রমাণ করে।
- ইঞ্জিনের `content.js`/`injected.js` মিনিফাই করা বান্ডেল; সোর্স রিপোজিটরিতে নেই — তাই বড় রিফ্যাক্টর ঝুঁকিপূর্ণ।
