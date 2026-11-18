# ArenaPilot V3 — Architecture & Product Specification
**পূর্ণাঙ্গ কারিগরি ব্লুপ্রিন্ট, কোডবেস অডিট এবং প্রোডাক্ট স্পেসিফিকেশন (Technical & Product Blueprint)**

- **Project:** ArenaPilot (`com.arenadeck.app`)
- **Repository:** `https://github.com/themuhammad-personal/Arenapilot`
- **Audited Baseline:** `v2.4.0` (`main` @ `80b9f0a`, `stabilize/v2.1.0` @ `c1270be`)
- **Target Architecture:** `ArenaPilot V3.0`
- **Date:** November 18, 2026
- **Status:** **Revised Draft R1** — Technical Review & Validation প্রয়োগকৃত (২০২৬-১১-১৮)। **Phase 0 (Proof of Feasibility) গেট অসম্পন্ন — PoF-নির্ভর অংশ বাস্তবায়নের জন্য প্রস্তুত নয়** (দেখুন §০)
- **Revision:** R1 — Baseline `main` @ `0d68014` (এই Spec-এর মূল কমিট); প্রতিটি দাবি Evidence-ট্যাগসহ (§০.১)

---

## সূচিপত্র (Table of Contents)

0. [Revision R1 — Evidence Classification, Status Legend ও Revision Summary](#0-revision-r1--evidence-classification-status-legend-ও-revision-summary)
1. [সম্পূর্ণ Codebase Audit ও বর্তমান অবস্থার বাস্তব চিত্র (v2.4.0 Audit)](#1-সম্পূর্ণ-codebase-audit-ও-বর্তমান-অবস্থার-বাস্তব-চিত্র-v240-audit)
2. [অনলাইন গবেষণা ও বহিরাগত প্রযুক্তির সক্ষমতা যাচাই (Online Research & Evidence)](#2-অনলাইন-গবেষণা-ও-বহিরাগত-প্রযুক্তির-সক্ষমতা-যাচাই-online-research--evidence)
3. [প্রকল্পের মূল লক্ষ্য, Product Vision ও Non-Goals](#3-প্রকল্পের-মূল-লক্ষ্য-product-vision-ও-non-goals)
4. [V3 System Architecture ও Component Interaction Blueprint](#4-v3-system-architecture-ও-component-interaction-blueprint)
5. [চারটি Direct Mode-এর পূর্ণাঙ্গ আচরণ ও স্পেসিফিকেশন (Text, Code, Search, Image)](#5-চারটি-direct-mode-এর-পূর্ণাঙ্গ-আচরণ-ও-স্পেসিফিকেশন-text-code-search-image)
6. [Code Mode (সর্বোচ্চ অগ্রাধিকার): Official Sandbox ও Persistent Storage সমন্বয়](#6-code-mode-সর্বোচ্চ-অগ্রাধিকার-official-sandbox-ও-persistent-storage-সমন্বয়)
7. [GitHub Agent ও Repository Workflow Specification](#7-github-agent-ও-repository-workflow-specification)
8. [Native Persistent Storage ও File Management System](#8-native-persistent-storage-ও-file-management-system)
9. [Memory ও Project System Specification](#9-memory-ও-project-system-specification)
10. [File Upload ও Multi-Format File Analysis Pipeline](#10-file-upload-ও-multi-format-file-analysis-pipeline)
11. [Native Settings ও Application Experience](#11-native-settings-ও-application-experience)
12. [Data Model, Room SQLite Schema, Storage Lifecycle ও Migration Strategy](#12-data-model-room-sqlite-schema-storage-lifecycle-ও-migration-strategy)
13. [Security, Privacy ও Data Ownership Architecture](#13-security-privacy-ও-data-ownership-architecture)
14. [Error Handling, Process Recovery ও Long-Running Task Management](#14-error-handling-process-recovery-ও-long-running-task-management)
15. [UI/UX ও Mobile-First Navigation Structure](#15-uiux-ও-mobile-first-navigation-structure)
16. [Testing Strategy, CI Verification Gates ও Acceptance Criteria](#16-testing-strategy-ci-verification-gates-ও-acceptance-criteria)
17. [Performance, RAM, Battery ও Storage Requirements](#17-performance-ram-battery-ও-storage-requirements)
18. [Phased Development Roadmap, Dependencies ও Implementation Guide](#18-phased-development-roadmap-dependencies-ও-implementation-guide)
19. [Technical Risks, Honest Limitations ও Unresolved Questions](#19-technical-risks-honest-limitations-ও-unresolved-questions)
20. [Architecture Decision Records (ADR-001 থেকে ADR-014)](#20-architecture-decision-records-adr-001-থেকে-adr-014)
21. পরিশিষ্ট: [A — PoF ক্যাটালগ](#পরিশিষ্ট-a--proof-of-feasibility-pof-ক্যাটালগ-revision-r1) · [B — Source তালিকা](#পরিশিষ্ট-b--source-ও-evidence-তালিকা-access-date-২০২৬-১১-১৮) · [C — Change Log](#পরিশিষ্ট-c--revision-r1-change-log-section-ভিত্তিক)

---

## 0. Revision R1 — Evidence Classification, Status Legend ও Revision Summary

> **Revision R1 (2026-11-18) — Technical Review & Validation Pass।** এই সংশোধনে Product Vision, চারটি Direct Mode, Native Storage, Memory, Projects, File Analysis, GitHub, Security ও Roadmap-এর মূল পরিকল্পনা অক্ষুণ্ণ রাখা হয়েছে। পরিবর্তন করা হয়েছে কেবল সেই সিদ্ধান্তগুলো, যেগুলো অনুমাননির্ভর, প্রযুক্তিগতভাবে ভুল বা বাহ্যিক সীমাবদ্ধতা বিবেচনা না করে লেখা হয়েছিল। **এই নথি আর "Ready for Implementation" নয়:** Phase 0 (Proof of Feasibility) সম্পন্ন ও প্রমাণিত না হওয়া পর্যন্ত `OfficialSandboxSyncEngine`, Stream/DOM Capture, Hydration এবং Performance Claim-সংক্রান্ত অংশ **Conditional/Proposed**।

### ০.১ তথ্যের শ্রেণিবিভাগ (Evidence Classes) — পুরো নথিতে ব্যবহৃত ট্যাগ

| ট্যাগ | অর্থ | কী প্রমাণ লাগে |
|---|---|---|
| **[VF] Verified Fact** | বাস্তব কোড, বাস্তবে চালানো পরীক্ষা, বা Official Source-এর সরাসরি পাঠ দিয়ে প্রমাণিত | কোডের ফাইল:লাইন / পরীক্ষার তারিখ ও ফলাফল / Official URL |
| **[RF] Research Finding** | নির্ভরযোগ্য বহিরাগত Documentation থেকে পাওয়া; ArenaPilot-এর ওপর বাস্তবে এখনো পরীক্ষিত নয় | Source Title + URL + Access Date |
| **[PD] Proposed Design** | ভবিষ্যৎ বাস্তবায়নের জন্য প্রস্তাবিত নকশা; কার্যকারিতা প্রমাণিত নয় | যুক্তি + Acceptance Criteria |
| **[UA] Unverified Assumption** | এখনো পর্যাপ্তভাবে যাচাই হয়নি | চিহ্নিত PoF বা সূত্র |
| **[PoF] Proof of Feasibility Required** | বাস্তব পরীক্ষা ছাড়া গ্রহণযোগ্য নয়; Appendix A-তে পরীক্ষা সংজ্ঞায়িত | Appendix A-র Pass Criteria |
| **[KL] Known Limitation** | প্রযুক্তিগত বা বাহ্যিক সীমাবদ্ধতা; লুকানো যাবে না | সীমাবদ্ধতার বর্ণনা ও Mitigation |

**ADR Status:** `Proposed` (প্রস্তাবিত) · `Conditional` (PoF পাস করলে কার্যকর; ব্যর্থ হলে বিকল্প নির্ধারিত) · `Validated` (বাস্তব প্রমাণসহ) · `Rejected` (বাতিল)। এই Revision-এ **কোনো ADR-ই Arena Sandbox সংক্রান্ত বিষয়ে `Validated` নয়**।

**Source নীতি:** Official Documentation ( developer.android.com, docs.github.com, arena.ai অফিসিয়াল পেজ) অগ্রাধিকার পেয়েছে। Blog, Stack Overflow, GitHub Issue/PR বা তৃতীয় পক্ষের নিবন্ধ **Official Documentation হিসেবে উপস্থাপন করা হয়নি**; সেগুলো ব্যবহৃত হলে স্পষ্টভাবে "Secondary" লেখা আছে। সব Source Appendix B-তে তালিকাভুক্ত (Access Date: 2026-11-18)।

### ০.২ Revision R1-এ কী কী পরিবর্তিত হয়েছে (সংক্ষিপ্ত)

| বিষয় | V3 Draft (আগে) | R1 (এখন) |
|---|---|---|
| Official Sandbox Sync | "Tri-Channel" ও Stream/DOM Capture কার্যকর ধরে নিয়ে চূড়ান্ত | **Conditional**। ৩-স্তর Capture (Tier A Stream / Tier B DOM / Tier C Sandbox-side Verification) + Hash-Verified Ingest; যা যাচাইবিহীন তা "SYNCED" নয় |
| ছোট-বড় সব দাবির প্রমাণ | নির্দিষ্ট করা নেই | প্রতিটি দাবিতে [VF]/[RF]/[UA] ট্যাগ |
| Master Copy | সবসময় Internal Storage | **পরিস্থিতিভিত্তিক Source-of-Truth Matrix** (৮.৭) |
| Storage | `filesDir` + DocumentsProvider = "স্থায়ী" | **৩-স্তর Storage** + স্পষ্ট নির্দেশ: DocumentsProvider ≠ Uninstall/Clear Data সুরক্ষা |
| Credential | `androidx.security:security-crypto` (`MasterKey`) | **Deprecated** [VF] → প্ল্যাটফর্ম Android Keystore + AES-GCM সরাসরি (ADR-009 সংশোধিত) |
| Bridge | `addJavascriptInterface` + Main-frame URL ট্র্যাকিং | **`addWebMessageListener` + `allowedOriginRules`** + Capability Broker (ADR-013) |
| Token সুরক্ষা দাবি | "XSS হলেও ফাঁস অসম্ভব" | **ভুল দাবি বাতিল**: Confused-Deputy ঝুঁকি স্বীকৃত; প্রতিটি Native Capability-এ Authorization/Scope/Audit |
| Model | সব মডেল সমান ধরা | **Model Capability Registry + Compatibility Matrix** (৫.৪) |
| PDF | `PdfRenderer` দিয়ে Text Extraction | `PdfRenderer` API ≤34-এ **Text দেয় না** [VF]; Parser Library + OCR সিদ্ধান্ত (১০.৪) |
| GitHub | `?recursive=1` একবারেই সব | `truncated` ও 100,000/7 MB সীমা [VF]; Subtree Recovery, Branch Race, Feature-Branch-Only নীতি (৭.৫) |
| Schema | ১০টি টেবিল; Enum/FK অসংগতি | Normative Schema Errata ও Lifecycle (১২.৩) |
| Performance | ৩০–৪০ MB, ৫০%+, <50ms, শূন্য UI Freeze | **Hypothesis**; Benchmark পদ্ধতিসহ (১৭) |
| Roadmap | Phase 0 = Hygiene | **Phase 0 = Research & PoF Gate**; ফাউন্ডেশন-প্রথম পুনর্বিন্যাস (১৮) |
| ADR | সব "Decision/Consequences" | Status, বিকল্প, ঝুঁকি, Failure, Migration সহ (২০) |

### ০.৩ এই Revision-এ বাস্তবে কী করা হয়েছে এবং কী করা হয়নি (সততার তালিকা)

- **বাস্তবে সম্পন্ন [VF]:** (ক) Repository-র Git Status/Branch যাচাই (`main`, Clean, HEAD `0d68014`); (খ) Kotlin/JS কোডবেস `grep`/পাঠ (`injected.js`, `sd-site.js`, `MainFrameTracker.kt`, `MainActivity.kt`, `build.gradle`, `AndroidManifest.xml`); (গ) `arena.ai/code/direct`-এর **Unauthenticated** HTML Fetch; (ঘ) GitHub REST API-তে **Read-only** পরীক্ষা (এই Repository-র Recursive Tree, বড় Blob, Rate-Limit/Permission Header) — ফলাফল ৭.৫-এ; (ঙ) Official Android/GitHub Documentation পাঠ।
- **বাস্তবে সম্পন্ন হয়নি [PoF Pending]:** Appendix A-র **PoF-S1…S12** (Official Direct Code Sandbox-এর ১২টি পরীক্ষা) — এর জন্য **Authenticated Arena Session ও Android Device** দরকার, যা এই Revision-এর পরিবেশে ছিল না। এগুলো **পরিকল্পনা মাত্র**; কোনো ফলাফল দাবি করা হয়নি।
- **কোনো Application কোড, Config, Workflow, README, PLAN, PROGRESS পরিবর্তন করা হয়নি।**

---

---

## 1. সম্পূর্ণ Codebase Audit ও বর্তমান অবস্থার বাস্তব চিত্র (v2.4.0 Audit)

স্পেসিফিকেশন তৈরির পূর্বে রিপোজিটরির প্রতিটি Kotlin ফাইল (`android/app/src/main/java/com/arenadeck/app/*.kt`), JavaScript ইঞ্জিন অ্যাসেট (`android/app/src/main/bds-assets/bds/*`), ইউনিট ও ইন্টিগ্রেশন টেস্ট (`android/app/src/test/`), এবং CI ওয়ার্কফ্লো (`.github/workflows/build-and-release-apk.yml`) সরাসরি লাইন-বাই-লাইন পরীক্ষা করা হয়েছে।

### ১.১ সোর্স ট্রি ইনভেন্টরি (Source Tree Inventory)

| স্তর (Layer) | ফাইলসমূহ | আকার / লাইন সংখ্যা | প্রকৃত ভূমিকা (Verified Role in v2.4.0) |
|---|---|---|---|
| **Android Activity & UI Shell** | `MainActivity.kt`, `BootScreenView.kt`, `IndependenceNotice.kt`, `UiPolish.kt` | `MainActivity.kt`: 1,789 লাইন (89 KB)<br>`BootScreenView.kt`: 461 লাইন<br>`UiPolish.kt`: 300 লাইন | একক WebView হোস্ট যা `https://arena.ai` লোড করে, প্রতিটি পেজ লোডে `bds-assets/bds/` ইনজেক্ট করে, এবং `UiPolish.kt` দিয়ে অপ্রাসঙ্গিক সেটিংস DOM থেকে লুকিয়ে রাখে। |
| **WebView Bridge & Network** | `WebViewBridge.kt`, `NativeBlobStore.kt`, `NetworkGuard.kt`, `EngineStore.kt`, `Downloads.kt`, `PageActions.kt`, `ChatUrls.kt`, `Site.kt`, `MainFrameTracker.kt`, `UpdateChecker.kt`, `ModelList.kt`, `Utf8Chunker.kt` | `WebViewBridge.kt`: 2,358 লাইন (100 KB)<br>`UpdateChecker.kt`: 572 লাইন<br>`EngineStore.kt`: 147 লাইন<br>`NativeBlobStore.kt`: 167 লাইন | `window.AndroidBridge` প্রদান করে। স্টোরেজ (`SharedPreferences` + `EngineStore` ফাইল), ফাইল পিকার (`NativeBlobStore` স্ট্রিমিং `/__sd/blob/<token>`), ডাউনলোড (`MediaStore`), ওয়েব ফেচ, GitHub ZIP/Commits ফেচ এবং MCP HTTP ক্লায়েন্ট পরিচালনা করে। |
| **Legacy On-Device Linux Sandbox** | `Sandbox.kt`, `SandboxService.kt`, `SandboxTools.kt`, `StudioActivity.kt`, `StudioPreview.kt`, `StudioSheet.kt`, `ShellProtocol.kt`, `TarGz.kt` | `StudioActivity.kt`: 1,362 লাইন<br>`Sandbox.kt`: 864 লাইন<br>`SandboxTools.kt`: 397 লাইন<br>`SandboxService.kt`: 189 লাইন | ডিভাইসের ভেতরে `proot` + Alpine Linux পরিবেশ চালায় এবং `sandbox://linux` নামে একটি লোকাল MCP সার্ভার প্রকাশ করে। **V3 নির্দেশনা অনুযায়ী এটি অবলোপনের (Decommission) তালিকায়।** |
| **Injected Engine Bundles (Minified)** | `content.js`, `injected.js`, `sandbox.js`, `content.css` | `content.js`: 3,355,954 bytes (4,037 লাইন)<br>`sandbox.js`: 1,219,979 bytes (249 লাইন)<br>`injected.js`: 69,095 bytes (632 লাইন)<br>`content.css`: 115,030 bytes | মূলত `chat.deepseek.com`-এর জন্য তৈরি একটি মিনিফাইড Svelte ব্রাউজার এক্সটেনশন বান্ডেল (`better-deepseek-android`), যার সোর্স কোড রিপোজিটরিতে নেই। এর ভেতরে স্ট্রিং-প্যাচ ও শেষে কাস্টম ফাংশন (`sdsArena*`, `sdBuildOverview`, `__sdHandleBack`) জোড়া লাগানো হয়েছে। |
| **Custom Arena & Agent Scripts (Unminified)** | `sd-site.js`, `sd-agent.js`, `sd-native.js`, `sd-sheets.js`, `sd-health.js`, `our-skin.css` | `sd-agent.js`: 1,879 লাইন<br>`sd-site.js`: 1,127 লাইন<br>`sd-native.js`: 869 লাইন<br>`sd-sheets.js`: 490 লাইন<br>`sd-health.js`: 456 লাইন | `sd-site.js` Arena.ai-এর DOM সিলেক্টর, API পাথ (`/nextjs-api/stream/create-evaluation` ও `post-to-evaluation/`), এবং ৪টি Direct Mode প্রোফাইল সংজ্ঞায়িত করে। `sd-agent.js` স্ট্রিম রিকভারি, অটো-কন্টিনিউ ও লোকাল স্যান্ডবক্স কল পরিচালনা করে। |
| **Build, Scripts & Tests** | `package.json`, `scripts/*`, `models/*`, `tools/harness/*`, `android/ci/*` | 31টি Kotlin ইউনিট টেস্ট, 38টি Node `.test.mjs` ফাইল (`362+` সাবটেস্ট) | ইউনিট টেস্ট, Chromium ফিক্সচার হারনেস এবং Android API 34 Emulator স্মোক টেস্ট চালায়। |

---

### ১.২ বিদ্যমান ফিচারের প্রকৃত অবস্থা (Working vs. Partial vs. Dead/UI-Only Audit Matrix)

| ফিচার / সাবসিস্টেম | বর্তমান অবস্থা | কোডবেস প্রমাণ (Code Evidence) | প্রকৃত সীমাবদ্ধতা ও সমস্যা |
|---|---|---|---|
| **Direct Mode Routing (Text, Code, Search, Image)** | **আংশিক কার্যকর (Partial)** | `ChatUrls.kt:28`, `sd-site.js:415-498`, `injected.js:598-615` | ৪টি রুট শনাক্ত হয় এবং Image মোডে প্রম্পট ইনজেকশন বন্ধ থাকে (`inject: false`)। কিন্তু `/c/{id}` পেজে রিলোড বা ক্র্যাশ রিকভারির পর মডালিটি ডিফল্টভাবে `'chat'`-এ ফিরে যায় কারণ `lastModality` শুধু মেমরিতে থাকে। |
| **Code Mode Execution Environment** | **দ্বান্দ্বিক / ভুল আর্কিটেকচার (Conflicting)** | `sd-site.js:113-120, 422-430`, `Sandbox.kt`, `SandboxTools.kt` | Arena-এর নিজস্ব Official Cloud Sandbox থাকা সত্ত্বেও অ্যাপটি নিজের লোকাল PRoot Alpine স্যান্ডবক্স (`<APH:AUTO:MCP url="sandbox">`) ইনজেক্ট করে এবং `CODE_ADDENDUM`-এ একক `index.html` দিতে বলে। Official Sandbox-এর ফাইল Android স্টোরেজে সংরক্ষণের কোনো ব্যবস্থা নেই। |
| **GitHub Integration** | **অকার্যকর / UI থেকে বিচ্ছিন্ন (Broken / Unreachable)** | `WebViewBridge.kt:1600-1850`, `content.js:sdBuildOverview`, `engine-scope-prune.test.mjs:21-38` | `WebViewBridge.kt`-এ কেবল ZIP ডাউনলোড (`bds-fetch-github-zip`) ও কমিট লিস্ট (`bds-fetch-github-commits`) আছে। কিন্তু v2.2.0-এ Settings থেকে `"data"` (`Integrations & backup`) ট্যাব এবং `+` শিট থেকে GitHub কার্ড (`C(V,!1,!0)`) মুছে ফেলায় **ব্যবহারকারী অ্যাপের কোথাও `githubToken` বসাতে বা রিপোজিটরি যুক্ত করতে পারে না!** কোনো ব্রাঞ্চ তৈরি, ফাইল এডিট, কমিট, পুশ বা PR-এর কোড নেই। |
| **File Upload (Images & Plain Text)** | **আংশিক কার্যকর (Partial)** | `WebViewBridge.kt:435-840`, `content.js:3752-3774` (`sdsArenaInlineFile`), `sd-native.js:500-590` | ছবিগুলো Arena-এর `<input type="file">`-এ যায় এবং সাধারণ টেক্সট/কোড ফাইলগুলো (`txt`, `md`, `js`, `py`, `kt` ইত্যাদি) কমপোজারের মেসেজে Markdown কোড ব্লক হিসেবে পেস্ট হয়। |
| **File Upload & Analysis (PDF, DOCX, XLSX, PPTX, ZIP)** | **সম্পূর্ণ অকার্যকর (Non-functional on Arena)** | `sd-site.js:206-214`, `content.js:3752-3774`, `WebViewBridge.kt:238-260` | Arena.ai-এর `<input type="file">` কেবল ছবি (`image/png, image/jpeg, image/webp`) গ্রহণ করে। আবার `sdsArenaInlineFile()` বাইনারি ফাইল (`pdf`, `docx`, `xlsx`, `pptx`, `zip`) প্রত্যাখ্যান করে। ফলে এই ফাইলগুলো পিক করলেও Arena.ai-তে আপলোড বা বিশ্লেষণ করা যায় না! |
| **Memory System** | **প্রাথমিক / সীমাবদ্ধ (Basic)** | `content.js:dmt()`, `injected.js:3-25`, `EngineStore.kt` | `bds_memories` কেবল একটি গ্লোবাল ফ্ল্যাট কি-ভ্যালু ম্যাপ (`{ key: { value, importance } }`)। এতে কোনো Project Isolation, উৎস (Provenance), টাইমস্ট্যাম্প বা সার্চ ইনডেক্স নেই। |
| **Project System** | **প্রাথমিক / সীমাবদ্ধ (Basic)** | `content.js:Lr()`, `injected.js:375-395` (`Q()`, `Z()`), `EngineStore.kt` | প্রজেক্টের সব ফাইল একত্রে একটি বিশাল JSON স্ট্রিং (`bds_project_files`) হিসেবে `EngineStore`-এ থাকে। BM25 চ্যাঙ্কিং (`injected.js:Q`) কেবল মেমরিতে থাকা টেক্সটে চলে। ডিভাইসের নেটিভ ফাইল সিস্টেমে কোনো প্রজেক্ট ফোল্ডার থাকে না, আর চ্যাট সেশনের সাথে প্রজেক্টের স্থায়ী বাইন্ডিং নেই। |
| **Native File Management & Persistent Storage** | **অনুপস্থিত (Missing)** | `EngineStore.kt`, `Downloads.kt`, `StudioActivity.kt` | অ্যাপে কেবল ওয়ান-ওয়ে ডাউনলোড (`MediaStore.Downloads`) এবং লোকাল PRoot স্যান্ডবক্সের জন্য `StudioActivity` ফাইল ব্রাউজার আছে। সাধারণ প্রজেক্ট, আপলোডকৃত ফাইল বা Official Sandbox-এর কাজের জন্য কোনো নেটিভ ফাইল ম্যানেজার বা `DocumentsProvider` নেই। |
| **Model List Subsystem (`ModelList.kt` & `models.json`)** | **অব্যবহৃত / মৃত কোড (Orphaned Code)** | `ModelList.kt`, `WebViewBridge.kt:1275-1277`, `scripts/fetch-models.mjs` | `WebViewBridge.kt`-এ `bds-model-list` হ্যান্ডলার এবং APK-এর ভেতরে ১,২৬৭ লাইনের `models.json` থাকা সত্ত্বেও `bds-assets/bds/*.js`-এর কোনো স্ক্রিপ্টই এটি কল করে না! |
| **Prompt Injection & Skill Triggers (`injected.js`)** | **ত্রুটিপূর্ণ (Buggy)** | `injected.js:368-374, 400-585` | ১) `t.includes(o)` সাবস্ট্রিং ম্যাচিংয়ের কারণে মেসেজে `"doc"`, `"report"`, `"sheet"`, `"word"` বা `"letter"` শব্দ থাকলেই (এমনকি Code Mode-এও!) ২২০+ লাইনের `[OFFICE SKILL]` (SheetJS/docx/PptxGenJS) ইনজেক্ট হয়ে প্রম্পট দূষিত করে।<br>২) `injected.js`-এর লাইন ৪০০-৫৮৫ জুড়ে অকার্যকর `APH:HARNESS_TASK` ("Deep Code") প্রম্পট রয়ে গেছে। |
| **Data Backup & Restore** | **UI থেকে বিচ্ছিন্ন (Unreachable)** | `content.js:sdBuildOverview`, `engine-scope-prune.test.mjs:21` | `content.js`-এর ভেতরে ব্যাকআপ/রিস্টোর লজিক থাকলেও v2.2.0-এ Settings Overview থেকে `"data"` রো মুছে ফেলায় ব্যবহারকারী ব্যাকআপ বা রিস্টোর করতে পারে না। |
| **MCP Client Integration** | **কার্যকর কিন্তু পুরোনো স্পেক (Working, Legacy Spec)** | `WebViewBridge.kt:1940-2110`, `content.js:m1()` | Streamable HTTP (`2024-11-05`) ও `Mcp-Session-Id` কাজ করে, তবে API Key প্লেইনটেক্সট JSON-এ (`bds_mcp_servers`) সংরক্ষিত থাকে এবং MCP 2026 স্ট্যাটলেস হেডার (`Mcp-Method`, `_meta`) সমর্থিত নয়। |

---

### ১.৩ বিদ্যমান আর্কিটেকচারের প্রধান কারিগরি দুর্বলতা ও ঝুঁকি (Technical Debt & Security Risks)

1. **মিনিফাইড মনোলিথ (`content.js` — 3.35 MB) রক্ষণাবেক্ষণের চরম ঝুঁকি:**
   `content.js` এবং `injected.js`-এর মূল TypeScript/Svelte সোর্স কোড রিপোজিটরিতে নেই। বর্তমানে রেগুলার এক্সপ্রেশন বা স্ট্রিং ইনডেক্স খুঁজে মিনিফাইড ফাইলের ভেতরে কোড পরিবর্তন করা হয়। এটি দীর্ঘমেয়াদে সম্পূর্ণ অটেকসই।
2. **`package.json`-এ ৪৫+ অপ্রয়োজনীয় ডিপেন্ডেন্সি:**
   `@electric-sql/pglite`, `@tanstack/react-start`, `better-auth`, `kysely`, `pg`, `nitro` ইত্যাদি প্যাকেজ `package.json` এবং ৮,৪৯১ লাইনের `package-lock.json`-এ পড়ে আছে, যা অ্যাপ বা টেস্ট কোনোটিতেই ব্যবহৃত হয় না।
3. **সিঙ্ক্রোনাস `@JavascriptInterface` স্টোরেজ বটলনেক:**
   `chrome.storage.local` পলিফিল (`content.js:vw`) প্রতিটি রিড/রাইটে সিঙ্ক্রোনাসভাবে `AndroidBridge.getStorage(key)` ও `setStorage(key, JSON.stringify(val))` কল করে। প্রজেক্ট ফাইল বা মেমরি কয়েক মেগাবাইট হলেই WebView-এর JS থ্রেড ও JNI ব্রিজ ফ্রিজ হয়ে যায়।
4. **রেন্ডারার প্রসেস কিল (`reason=12/13`) ও ভোলাটাইল মেমরি লস:**
   Android লো-মেমরি কিলার যখন ব্যাকগ্রাউন্ডে বা বড় ফাইল পিকের সময় WebView-এর স্যান্ডবক্সড রেন্ডারার প্রসেস মেরে ফেলে, তখন `injected.js`-এর `sdsArenaRing` (১৬টি টার্নের বাফার) ও `sd-site.js`-এর `lastModality` সম্পূর্ণ মুছে যায়।
5. **প্লেইনটেক্সট গোপন তথ্য সংরক্ষণ (Plaintext Secrets in `EngineStore`):**
   `githubToken` এবং MCP সার্ভারের `apiKey` সাধারণ JSON ফাইল হিসেবে `filesDir/engine-store/` বা `SharedPreferences`-এ অরক্ষিত অবস্থায় থাকে; Android Keystore ব্যবহৃত হয়নি।

### ১.৪ Revision R1 — কোডবেস থেকে যাচাইকৃত অতিরিক্ত অডিট তথ্য [VF]

R1-এ নিচের তথ্যগুলো Repository (`main` @ `0d68014`) থেকে সরাসরি যাচাই করা হয়েছে; এগুলো V3 Draft-এর বিভিন্ন সিদ্ধান্তকে প্রভাবিত করে:

| # | যাচাইকৃত তথ্য | প্রমাণ | প্রভাব |
|---|---|---|---|
| 1 | বর্তমান Stream Parser শুধু `a0` (text), `ag` (reasoning), `a3` (error), `ad`/`d`/`e` (finish) বোঝে। **Tool-call/Tool-result ইভেন্টের কোনো Wire-Format Repository-তে নেই; কোনো কোড তা পার্স করে না।** | `injected.js:600-629`, `sd-site.js:241` | "Network Stream থেকে `create_file{path,content}` পাওয়া যায়" — **[UA]**, V3 Draft-এ ভুলভাবে Fact হিসেবে লেখা ছিল |
| 2 | বর্তমান Code Mode Tool-Protocol হলো **মডেল-নির্গত Text Tag** (`<APH:create_file fileName=...>`, `<APH:AUTO:MCP …>`), Arena-র Structured Official Tool Call নয় | `sd-site.js:110-122` | Text Tag ≠ Official Sandbox Tool Call; দুটিকে একই ধরা যাবে না (৫.৪) |
| 3 | `[data-code-block='true']` সিলেক্টরটি Chat Message-এর Code Block-এর জন্য "VERIFIED" চিহ্নিত; **CodeMirror Editor/File-tree সিলেক্টর Repository-তে নেই** | `sd-site.js:197` | `.cm-content` ও File Tree DOM Observer [UA] |
| 4 | Bridge হলো `addJavascriptInterface(bridge, "AndroidBridge")` — সব Frame-এ এক্সপোজড; Origin যাচাই হয় `MainFrameTracker` দিয়ে WebView URL তুলনা করে | `MainActivity.kt:687`, `MainFrameTracker.kt:1-60` | Official Android Docs অনুযায়ী এটি নির্ভরযোগ্য Frame-Identity নয় (২.৭) → ADR-013 |
| 5 | `android:allowBackup="false"`; `minSdk=26`, `targetSdk=34`, `compileSdk=34` | `AndroidManifest.xml:48`, `build.gradle.kts:32-41` | Auto Backup বন্ধ → ডিভাইস পরিবর্তনে কোনো স্বয়ংক্রিয় Restore নেই; Android 15 PDF API সরাসরি ব্যবহারে `compileSdk` বৃদ্ধি দরকার |
| 6 | V3 Draft-এর §৬.২ ও §৭.২ যথাক্রমে `sandbox_command_logs` ও `github_tree_entries` টেবিল উল্লেখ করে; **§১২.১ Schema-তে এগুলো নেই** | Spec grep | Schema অসম্পূর্ণ → ১২.৩ |
| 7 | V3 Draft `<AP:…>` ও Repository-র বিদ্যমান `<APH:…>` — দুই ভিন্ন Tag Namespace মিশিয়ে ব্যবহার করেছে | Spec §৬, §৯, §১০ বনাম `sd-site.js` | একটি Versioned Protocol দরকার (৫.৪.৬) |

---

## 2. অনলাইন গবেষণা ও বহিরাগত প্রযুক্তির সক্ষমতা যাচাই (Online Research & Evidence)

প্রতিটি দাবির পাশে Evidence ট্যাগ (০.১) আছে। Source-এর পূর্ণ তালিকা Appendix B-তে।

### ২.১ Arena.ai Direct Mode ও Official Code Sandbox-এর প্রকৃত সক্ষমতা ও সীমাবদ্ধতা

#### ২.১.১ দুটি আলাদা Surface — একটির প্রমাণ অন্যটির প্রমাণ নয়

| Surface | বর্ণনা | যা প্রমাণিত | যা অপ্রমাণিত |
|---|---|---|---|
| **`https://arena.ai/code`** — Code Arena / Fullstack Code Arena | Arena-র Evaluation প্ল্যাটফর্ম (Battle / Side-by-Side / Direct); মডেলরা Agent হিসেবে Sandbox-এ কাজ করে | **[RF — Primary]** Arena Blog "The Next Stage of AI Coding Evaluation Is Here" (arena.ai/blog/code-arena; Search-Index-এ পৃষ্ঠার তারিখ ২০২৬-০৬-১৫): মডেল `create_file`, `edit_file`, `read_file`, `run_command` Structured Tool Call ব্যবহার করে; "Code sessions are restorable and persistent across visits"; প্রতিটি Prompt/Render/Action Logged। **[RF — Secondary]** তৃতীয়-পক্ষ সারাংশ (alphasignal.ai, stork.ai) দাবি করে Fullstack Update (২০২৬-০৭-০২)-এ `bash`, web search, persistent dev server যোগ হয়েছে এবং Snapshot Cloudflare R2-তে থাকে | Fullstack Blog-এর মূল পাঠ আমাদের `web_fetch`-এ পাওয়া যায়নি (পেজ JS-রেন্ডার; শুধু Title ফিরেছে — **[VF]** Title: "Build, Deploy, and Evaluate with Fullstack Code Arena"); R2 Snapshot-এর দাবি Secondary → **[UA]** |
| **`https://arena.ai/code/direct`** — Direct Mode Code Conversation (ArenaPilot যে Surface ব্যবহার করে) | ArenaPilot-এর Code Mode Route (`MODALITY_BY_SLUG: code→webdev`, `sd-site.js:423`) | **[VF]** (২০২৬-১১-১৮, Unauthenticated HTML Fetch) Route `/code/direct` বৈধ; Next.js Route-Tree-এ `modality=code`, `mode=direct`; Page Title "Directly Chat with Frontier AI Coding Models"; একই `[modality]/[mode]` Segment-Layout অন্য Modality-র সাথে ভাগ করা | **এই Route-এ নির্বাচিত মডেল Official Sandbox-এ Agent হিসেবে চলে কি না, কোন Tool পায়, ফাইল কোথায় থাকে, Reset আচরণ কী — কিছুই প্রমাণিত নয়।** Unauthenticated Fetch-এ Chat Session চালানো যায় না। **[PoF-S1…S12]** |

> **[UA] — সরাসরি স্বীকৃতি:** V3 Draft §২.১ ও §৫.৩B যে Tool-তালিকা (`bash`, `read_file`, `delete_file`, `list_files`, `glob_files`, `grep_files`, `web_search`, `web_fetch`) `/code/direct`-এর জন্য "Verified" হিসেবে লিখেছিল, তা **প্রমাণিত নয়**। Arena-র Official Blog শুধু `create_file`, `edit_file`, `read_file`, `run_command`-এর নাম উল্লেখ করে (`bash` নয় `run_command` — নামকরণ নিজেই অমিল)। Tool Schema, Tool Name ও Direct Mode-এ প্রাপ্যতা PoF-S1-এ **Live Session থেকে** সংগ্রহ করতে হবে।

#### ২.১.২ যা Verified (পুনর্নিশ্চিত) [VF]
- চারটি Direct Route ও `modality` ম্যাপিং (`text→chat`, `code→webdev`, `search→search`, `image→image`) — `sd-site.js:423`।
- **API পথ:** প্রথম টার্নে `POST /nextjs-api/stream/create-evaluation`, পরবর্তী টার্নে `POST /nextjs-api/stream/post-to-evaluation/{id}`; কথোপকথন শুরু হলে URL `/c/{evaluationId}` (V3 Draft থেকে উত্তরাধিকার; `sd-site.js`/`injected.js` কোডে সমর্থিত [VF]; Code Mode-এ Tool-Event বহন করে কি না [UA])।
- Chat Stream Line-Protocol: `a0:"text"`, `ag:"reasoning"`, `a3:"error"`, `ad:{finishReason,usage}` — `injected.js:600-629`। **Tool-event Wire-Format Repository-তে নেই।**
- রিকোয়েস্টে পেজ-মিন্টেড `recaptchaV3Token` থাকে (Repository-র বিদ্যমান ডকুমেন্টেশন ও কোড-মন্তব্য) → Native `OkHttp` থেকে সরাসরি Chat পাঠানো নিষিদ্ধ (Non-Goal ৩.৩.৩)।
- Page-HTML-এ Feature Flag `agent-mode-workspace-storage: true` দৃশ্যমান [VF: Flag-এর উপস্থিতি]। **অর্থ [UA]:** সম্ভবত Arena-র `/agent` Surface-এ নিজস্ব Workspace Storage আছে; এটি Direct Code Mode-এ প্রযোজ্য কি না অজানা। → Section ২.৪ ও PoF-S11 দেখুন (Arena-র নিজস্ব Persistence-কে অপ্রয়োজনে নকল না করার নীতি)।

#### ২.১.৩ Architecture-এর জন্য প্রযুক্তিগত সিদ্ধান্তমূলক সীমাবদ্ধতা [KL]
1. Official Sandbox Arena-র ক্লাউডে চলে (Blog: "controlled, isolated environments")। Android-এর Local FS-এ POSIX অ্যাক্সেস নেই — **[RF]** (যুক্তিসঙ্গত, কিন্তু Arena-র পক্ষ থেকে `/code/direct`-এর জন্য ঘোষিত নয়)।
2. Sandbox-এ ফাইল কীভাবে **পড়া** যায় (Tool Result-এ কী ফেরে), বাইনারি/বড় ফাইল, `bash`-এ হওয়া পরিবর্তন — **সব [UA]**।
3. Sandbox Session Reset/Expiry আচরণ — Blog "Sessions are restorable and persistent" বলে (**[RF]**), কিন্তু এর অর্থ Sandbox-এর **Process/Filesystem State** পুনরুদ্ধার নাকি শুধু Chat/Code-view Replay — **[UA]**।
4. **কোনো দ্বিতীয় Sandbox তৈরি করা যাবে না** (Hard Constraint)। ফলে Capture ব্যর্থ হলে বিকল্প হলো Export/Recovery Mechanism (৬.৮), অন্য Execution Environment নয়।

### ২.২ Android Native Storage ও File Access API (API 26–35)
- **[RF] Official:** *Access app-specific files* (developer.android.com/training/data-storage/app-specific): "When the user uninstalls your app, the files saved in app-specific storage are removed… you shouldn't use this storage to save anything that the user expects to persist independently of your app." এটি Internal ও `getExternalFilesDir()` — **দুটিতেই** প্রযোজ্য।
- **[RF] Official:** *Android storage use cases and best practices* — Internal Storage অন্য অ্যাপের জন্য নিষিদ্ধ এবং Android 10+ এ Encrypted।
- **[RF] Official:** *Document provider guide* (developer.android.com/guide/topics/providers/document-provider) — `DocumentsProvider` অন্য অ্যাপকে **আপনার অ্যাপের ডেটা পড়তে** দেয়; এটি সেই ডেটাকে Uninstall থেকে **বাঁচায় না** (ডেটা তখনও App-Private Storage-এ; Provider অ্যাপের অংশ, Uninstall-এ অদৃশ্য)। এই সিদ্ধান্ত App-specific Storage Doc থেকে যৌক্তিকভাবে প্রাপ্ত (Inference) — **PoF-D2** এ ডিভাইসে নিশ্চিত করতে হবে।
- **[RF] Official:** *Data backup overview* (developer.android.com/identity/data/backup): Auto Backup Android 6+ এ Google Drive-এ, **অ্যাপ প্রতি ২৫ MB সীমা**; বড় ব্যাকআপের জন্য Android Large Backups (ALB) API উল্লেখ। বর্তমান Manifest-এ `allowBackup=false` **[VF]**।
- **[RF] Secondary (AOSP-উৎস উদ্ধৃত):** Persisted URI Grant সীমা Android 11+ এ ৫১২ (পূর্বে ১২৮); সীমা ছাড়ালে পুরোনো Grant নীরবে বাদ যায়। Official Developer Doc-এ এই সংখ্যা নেই → **[PoF-D4]** দিয়ে ডিভাইসে যাচাই।
- **[RF] Official-সমর্থিত:** SAF-এর `ACTION_OPEN_DOCUMENT_TREE` + `takePersistableUriPermission()`; Document সরানো/মোছা হলে Grant অকার্যকর — Re-prompt দরকার।
- **[KL]** SAF দিয়ে POSIX-সংগতি নেই: Rename/Move Atomic নয়, `lastModified` ও Size নির্ভরযোগ্য নাও হতে পারে, বড় Tree Enumeration ধীর (প্রতিটি Child Query ContentResolver IPC)।
- `MANAGE_EXTERNAL_STORAGE` Google Play নীতির পরিপন্থী — **ব্যবহার করা হবে না** (V3 Draft-এর সিদ্ধান্ত বহাল)।

### ২.৩ GitHub REST API (Git Data API) ও Actions API
- **[VF] Official + বাস্তব পরীক্ষা:** *REST API endpoints for Git trees* (docs.github.com/en/rest/git/trees): "The limit for the tree array is **100,000 entries with a maximum size of 7 MB** when using the `recursive` parameter"; `truncated: true` হলে Non-recursive ভাবে এক-একটি Subtree আনতে হবে। (এই Repo-র ওপর পরীক্ষা: ২৭৫ Entry, ৮৮,১২১ বাইট, `truncated=false` — ৭.৫.১)।
- **[VF] Official + বাস্তব পরীক্ষা:** *Git blobs*: "supports blobs up to 100 megabytes"; Response `application/vnd.github+json`-এ `content` **base64** (বাস্তবে ৩,৩৫৫,৯৫৪ বাইট Blob base64-তে এসেছে, Git-Blob-SHA-1 মিলেছে)। `application/vnd.github.raw+json` Media Type-এ Raw Bytes।
- **[RF]** Secondary Rate Limit: ≤১০০ Concurrent Request, REST-এ ≤৯০০ Point/মিনিট (GET=1, POST/PATCH/PUT/DELETE≈5), ≈৮০ Content-generating Request/মিনিট, ≈৫০০/ঘণ্টা। GitHub বলে এগুলো বিনা নোটিশে বদলাতে পারে এবং বর্তমান ব্যবহার জানার উপায় নেই — তাই **Client-Side Throttle + `retry-after` সম্মান করা অবশ্যই** (Secondary Source: তৃতীয়-পক্ষ সংকলন; Official Rate-Limit Doc-এর সরাসরি Re-fetch → PoF-G6)।
- **[VF] বাস্তব পরীক্ষা:** Fine-grained PAT-এর Response-এ `x-accepted-github-permissions` Header (`contents=read` / `metadata=read`) এবং `github-authentication-token-expiration` Header উপস্থিত — Token মেয়াদ ও প্রয়োজনীয় Permission প্রোগ্রাম্যাটিকভাবে পড়া সম্ভব।

### ২.৪ Model Context Protocol (MCP) Specification
- V3 Draft-এর MCP সংস্করণ-সংক্রান্ত দাবি (`2025-03-26`, `2025-11-25`, `2026-07-28`) **R1-এ পুনরায় যাচাই করা হয়নি** → **[UA — Pending]**। Phase 8-এর আগে `modelcontextprotocol.io/specification` থেকে Changelog পুনরায় পাঠ আবশ্যক। কোনো সংস্করণকে "যাচাইকৃত" বলা হবে না।

### ২.৫ Credential Storage — `androidx.security:security-crypto`-এর বর্তমান অবস্থা
- **[VF] Official:** *AndroidX Security releases* (developer.android.com/jetpack/androidx/releases/security) — `security-crypto` Stable **1.1.0 (২০২৫-০৭-৩০)**। Release Notes: `1.1.0-alpha07` (২০২৫-০৪-০৯) ও `1.1.0-beta01` (২০২৫-০৬-০৪): **"Deprecated all APIs in favour of existing platform APIs and direct use of Android Keystore."**
- **সিদ্ধান্ত:** `EncryptedSharedPreferences`/`EncryptedFile`/`MasterKey` — **সব Deprecated API**। V3 Draft-এর ADR-009 ও Phase 1 (`security-crypto` যোগ করা) **বাতিল (Rejected)**। নতুন সিদ্ধান্ত ADR-009-R1: Android Keystore (AES-256-GCM, Non-exportable Key) + নিজস্ব Thin Envelope (`KeystoreCredentialVault`), Library নির্ভরতা ছাড়া।

### ২.৬ PDF — Android `PdfRenderer`-এর বাস্তব সক্ষমতা
- **[VF] Official:** *PdfRenderer.Page* API Reference: `getTextContents()`, `searchText(String)`, `selectContent(...)`, `getImageContents()` — **"Added in API level 35"** (Android 15)। `PageSelection` ইত্যাদি "Also in S Extensions 13"।
- **[RF] Secondary:** Android 12–14 ডিভাইসে SDK Extension ≥ 13 থাকলে `android.graphics.pdf.PdfRendererPreV` একই Text/Search Surface দেয় (ডিভাইস-নির্ভর; Emulator Image-এ Extension 13 সাধারণত নেই)।
- **নিশ্চিত সিদ্ধান্ত:** `PdfRenderer` (API 21–34 Platform Class) শুধু **Page → Bitmap Render** করে; **Text Extraction দেয় না**। V3 Draft-এর "PdfRenderer দিয়ে PDF Text Extraction"-এর পরিকল্পনা `minSdk=26` [VF]-এ **অধিকাংশ ডিভাইসে অকার্যকর**। বিস্তারিত ১০.৪।

### ২.৭ WebView Native Bridge নিরাপত্তা
- **[VF] Official:** *Access native APIs with JavaScript bridge* (developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge): `addWebMessageListener` **Recommended** — `allowedOriginRules` বাধ্যতামূলক; Listener প্রতিটি Message-এ `sourceOrigin` (এবং `isMainFrame`) পায়। `addJavascriptInterface` **Legacy/Low Security**: "available to every frame within the WebView, including iframes. It lacks origin-based access control… you must not rely on methods like `WebView.getUrl()` for security verification." ন্যূনতম WebView Version ৮২ (Jetpack Webkit ১.৩.০)।
- **প্রভাব [VF]:** ArenaPilot-এর বর্তমান Bridge (`addJavascriptInterface` + `MainFrameTracker`-এর URL তুলনা) ঠিক সেই প্যাটার্ন যা Official Doc নির্ভরযোগ্য নয় বলে সতর্ক করেছে → ADR-013।

### ২.৮ Portable Backup Key Derivation
- **[RF] Secondary (OWASP Password Storage Cheat Sheet-এর উদ্ধৃতি):** Argon2id ন্যূনতম m=19 MiB, t=2, p=1; FIPS প্রয়োজন হলে PBKDF2-HMAC-SHA256 ≥ ৬০০,০০০ iteration। OWASP-এর মূল পেজ R1-এ সরাসরি Fetch হয়নি → Implementation-এর আগে `cheatsheetseries.owasp.org` থেকে পুনরায় যাচাই (PoF-B1)। **Android Platform-এ Argon2 অন্তর্নির্মিত নয়** [UA→ PoF-B1 এ নিশ্চিত], PBKDF2 (`SecretKeyFactory`) আছে।

---

---

## 3. প্রকল্পের মূল লক্ষ্য, Product Vision ও Non-Goals

### ৩.১ Product Vision
**ArenaPilot V3** হবে একটি পূর্ণাঙ্গ, স্থিতিশীল, এবং **Model-Agnostic Agentic AI Workspace for Android**—যার মাধ্যমে ব্যবহারকারী `arena.ai`-এর Direct Mode-এ নিজের পছন্দমতো যেকোনো ফ্রন্টিয়ার বা ওপেন মডেল নির্বাচন করে সাধারণ কথোপকথন থেকে শুরু করে জটিল মাল্টি-ফাইল সফটওয়্যার ইঞ্জিনিয়ারিং, গভীর ওয়েব গবেষণা, ডকুমেন্ট বিশ্লেষণ এবং ইমেজ জেনারেশন পর্যন্ত সব কাজ একটি নেটিভ-মানের অ্যান্ড্রয়েড অ্যাপের ভেতর সম্পন্ন করতে পারবে।

### ৩.২ মূল লক্ষ্যসমূহ (Core Goals)
1. **Direct Mode Excellence:** Arena.ai-এর ৪টি Direct Mode (`Text`, `Code`, `Search`, `Image`)-এর প্রতিটির জন্য আলাদাভাবে অপ্টিমাইজড ইঞ্জিন, টুল ইন্টিগ্রেশন ও ইউজার এক্সপেরিয়েন্স নিশ্চিত করা।
2. **Code Mode as Flagship Agentic Workspace:** Code Mode-কে সর্বোচ্চ অগ্রাধিকার দিয়ে Arena-এর **Official Sandbox**-এর সাথে Android-এর **Native Persistent Storage** এবং **GitHub Workflow**-এর নিরবচ্ছিন্ন সমন্বয় ঘটানো।
3. **Single Sandbox Rule:** শুধুমাত্র Arena-এর Official Sandbox ব্যবহৃত হবে; অ্যাপের ভেতর থেকে লোকাল PRoot / Alpine Linux স্যান্ডবক্স সম্পূর্ণ অপসারণ করা হবে।
4. **Unified Native Storage Foundation:** Room SQLite + FTS4, অভ্যন্তরীণ Workspace File System, Android `DocumentsProvider` এবং SAF Folder Sync-এর সমন্বয়ে একটি একক, সুসংগঠিত স্টোরেজ ভিত্তি তৈরি করা।
5. **Isolated & Auditable Memory + Projects:** গ্লোবাল ও প্রজেক্ট-ভিত্তিক মেমরি এবং প্রজেক্ট ওয়ার্কস্পেসকে পরস্পর থেকে সুস্পষ্টভাবে আলাদা ও নিয়ন্ত্রণযোগ্য রাখা।
6. **True Multi-Format File Analysis:** ছবি ছাড়াও `PDF`, `DOCX`, `XLSX`, `PPTX`, `CSV`, `ZIP`, কোডবেস ও প্রজেক্ট ফোল্ডার নেটিভভাবে পার্স ও ইনডেক্স করে AI-কে প্রকৃত বিষয়বস্তু সরবরাহ করা।
7. **De-minified, Maintainable Modular Architecture:** মিনিফাইড `content.js`-এর ভেতর ঝুঁকিপূর্ণ স্ট্রিং-প্যাচিং বন্ধ করে পরিষ্কার Kotlin Native UI/Services এবং মডুলার, আন-মিনিফাইড ES Module অ্যাডাপ্টার স্থাপন করা।

### ৩.৩ Non-Goals (যা V3-এর আওতাভুক্ত নয়)
1. **Battle, Side-by-Side বা Arena Agent Mode পরিবর্তন না করা:** এই পেজগুলো অফিসিয়াল অবস্থায় অপরিবর্তিত থাকবে।
2. **কোনো দ্বিতীয় বা বিকল্প লোকাল কোড এক্সিকিউশন স্যান্ডবক্স তৈরি না করা:** কোনো লোকাল Linux, PRoot, Termux বা WebContainer এক্সিকিউশন স্যান্ডবক্স তৈরি করা হবে না।
3. **CAPTCHA, Cloudflare বা Login বাইপাস না করা:** ব্যবহারকারী অফিসিয়াল WebView-তেই সাইন-ইন করবে এবং মেসেজ সবসময় পেজের নিজস্ব কমপোজার দিয়েই যাবে।
4. **Image Mode-এ প্রম্পট পরিবর্তন না করা:** Image Mode-এ ব্যবহারকারীর প্রম্পটে কোনো সিস্টেম নির্দেশনা, মেমরি বা টুল ট্যাগ যুক্ত করা হবে না।
5. **ব্যবহারকারীর অনুমতি ছাড়া ফাইল বা নেটওয়ার্ক অ্যাক্সেস না করা:** কোনো ব্যাকগ্রাউন্ড টেলিমেট্রি, অনুমোদনহীন ফাইল স্ক্যান বা গোপন ডেটা প্রেরণ থাকবে না।

---

## 4. V3 System Architecture ও Component Interaction Blueprint

### ৪.১ লেয়ার্ড আর্কিটেকচার ডায়াগ্রাম (Layered System Architecture)

```
+---------------------------------------------------------------------------------------------------+
|                                   ARENAPILOT V3 ANDROID APP                                       |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | LAYER 1: ANDROID NATIVE UI & LIFECYCLE SHELL (Kotlin)                                       |  |
|  |  - MainActivity (WebView Host, Edge-to-Edge, Splash/Boot Guard, RendererCrashGuard)         |  |
|  |  - Native Workspace & Settings Sheets (BottomSheetDialogFragments / Native Views):          |  |
|  |      * Mode & Project Switcher Pill       * Native Settings Drawer (All 9 Categories)       |  |
|  |      * Workspace File Manager & Diff UI   * GitHub Repo, Branch, Commit & PR Sheet          |  |
|  |      * Memory & Project Inspector         * Image Mode Gallery & Prompt Vault               |  |
|  |  - TaskForegroundService (Keeps long Agent/Sync/GitHub tasks alive with Stop action)        |  |
|  +----------------------------------------------+----------------------------------------------+  |
|                                                 |                                                 |
|                                                 v                                                 |
|  +---------------------------------------------------------------------------------------------+  |
|  | LAYER 2: TYPED BRIDGE & SECURITY BOUNDARY (WebViewBridge V3)                                |  |
|  |  - Origin & Trust Gate (isTrustedBridgeUrl: https://arena.ai & https://www.arena.ai only)   |  |
|  |  - Async RPC Dispatcher (fetchAsync -> JSON-RPC 2.0 over callback + NativeBlobStore)        |  |
|  |  - Same-Origin Streaming Endpoint (/__sd/blob/<128-bit-token> via shouldInterceptRequest)   |  |
|  |  - NetworkGuard (DNS + IP SSRF filter blocking RFC1918, loopback, link-local, CGNAT)        |  |
|  |  - EncryptedCredentialVault (Android Keystore AES-256-GCM for GitHub PAT & MCP API Keys)    |  |
|  +----------------------------------------------+----------------------------------------------+  |
|                                                 |                                                 |
|                                                 v                                                 |
|  +---------------------------------------------------------------------------------------------+  |
|  | LAYER 3: CORE DOMAIN & AGENT ENGINES (Kotlin Coroutines / Executors)                        |  |
|  |  +------------------------+  +--------------------------+  +-----------------------------+  |  |
|  |  | ModeOrchestrator       |  | OfficialSandboxSyncEngine|  | GitHubAgentEngine           |  |  |
|  |  | - Text / Code /        |  | - Stream Artifact Capture|  | - Git Data API (Trees/Blobs)|  |  |
|  |  |   Search / Image rules |  | - Snapshot Versioning    |  | - Atomic Multi-File Commit  |  |  |
|  |  | - Context Budgeter     |  | - Sandbox Hydration Pack |  | - Branch, Push, PR & CI Run |  |  |
|  |  +------------------------+  +--------------------------+  +-----------------------------+  |  |
|  |  +------------------------+  +--------------------------+  +-----------------------------+  |  |
|  |  | FileAnalysisEngine     |  | Project & Memory Engine  |  | McpClientEngine & WebFetch  |  |  |
|  |  | - PDF / DOCX / XLSX /  |  | - Scoped Memory Retrieval|  | - Streamable HTTP 2025/2026 |  |  |
|  |  |   PPTX / ZIP / Code    |  | - Project BM25 + Symbol  |  | - Readability Web Extractor |  |  |
|  |  | - Vision Image Prep    |  |   Context Builder        |  | - Citation Cross-Checker    |  |  |
|  |  +------------------------+  +--------------------------+  +-----------------------------+  |  |
|  +----------------------------------------------+----------------------------------------------+  |
|                                                 |                                                 |
|                                                 v                                                 |
|  +---------------------------------------------------------------------------------------------+  |
|  | LAYER 4: UNIFIED PERSISTENCE & NATIVE STORAGE FOUNDATION                                    |  |
|  |  - ArenaDatabase (Room SQLite + WAL + FTS4): Projects, Files, Snapshots, Memories,          |  |
|  |    Conversations, Turns, TaskCheckpoints, GitHubRepos, UploadedArtifacts, GeneratedImages   |  |
|  |  - WorkspaceFileSystem (filesDir/workspaces/<projectId>/tree/ & snapshots/<turnId>/)        |  |
|  |  - ArenaWorkspaceDocumentsProvider (Exposes workspaces to Android Files app & SAF clients)  |  |
|  |  - SafFolderSyncManager (Two-way sync with user-picked external storage folders)            |  |
|  +----------------------------------------------+----------------------------------------------+  |
|                                                 |                                                 |
|                                                 v                                                 |
|  +---------------------------------------------------------------------------------------------+  |
|  | LAYER 5: INJECTED WEBVIEW PAGE ADAPTER (Modular Unminified ES2020 Scripts in assets/ap/)    |  |
|  |  - ap-site-profile.js     (Route, Modality & Selector Detection for arena.ai)               |  |
|  |  - ap-stream-hook.js      (Intercepts create-evaluation & post-to-evaluation streams,       |  |
|  |                            extracts raw text, Official Sandbox tool calls & file artifacts) |  |
|  |  - ap-context-injector.js (Applies mode-specific prompt, scoped memory, project files &     |  |
|  |                            parsed document context on outbound user turns; ZERO on Image)   |  |
|  |  - ap-sandbox-observer.js (Captures CodeMirror 6 / Preview files from Official Sandbox DOM) |  |
|  |  - ap-ui-mount.js         (Mounts lightweight trigger buttons into #bds-root)               |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### ৪.২ Component Responsibility ও ডিকাপলিং নীতি (Decoupling Principles)

1. **WebView কেবল Chat ও Official Sandbox Surface:**
   WebView-এর কাজ হলো `arena.ai`-এর আসল পেজ ও অফিসিয়াল স্যান্ডবক্স রেন্ডার করা এবং স্ট্রিম/কমপোজার ইন্টারসেপ্ট করা। অ্যাপের কোনো স্থায়ী ডেটা (প্রজেক্ট ফাইল, মেমরি, টার্ন হিস্ট্রি, টাস্ক চেকপয়েন্ট, সেটিংস) আর WebView-এর মেমরিতে বা `chrome.storage.local` পলিফিলে একক ব্লব হিসেবে থাকবে না।
2. **মিনিফাইড `content.js`-এর ওপর নির্ভরতা কমানো (Strangler Fig Pattern):**
   V3-তে নতুন কোনো ফিচার মিনিফাইড `content.js` বা `injected.js`-এর ভেতরে স্ট্রিং-প্যাচ করে যোগ করা হবে না। সমস্ত নতুন প্রোডাক্ট লজিক থাকবে:
   - **Android Native Kotlin Layer (`com.arenadeck.app.v3.*`)**-এ এবং
   - **Clean Unminified Modular JS (`android/app/src/main/assets/ap/*.js`)**-এ।
3. **একমুখী কনফিগারেশন প্রবাহ (Single Source of Truth):**
   `SettingsRepository` (Kotlin) হবে সমস্ত কনফিগারেশনের একমাত্র উৎস। ব্যবহারকারী সেটিংস পরিবর্তন করার সাথে সাথে Kotlin লেয়ার তা সংরক্ষণ করবে এবং `window.__apBridge.onConfigUpdated(snapshotJson)` ইভেন্টের মাধ্যমে WebView-এর অ্যাডাপ্টারে পাঠিয়ে দেবে।

### ৪.৩ Revision R1 — Diagram Errata ও পরিপূরক Architecture

**৪.১-এর Diagram-এ নিম্নলিখিত সংশোধন প্রযোজ্য (Diagram-এর Layer কাঠামো বহাল; লেবেল/স্ট্যাটাস সংশোধিত):**

| Diagram-এর অংশ | সমস্যা | R1 সংশোধন |
|---|---|---|
| Layer 2 — "Origin & Trust Gate (isTrustedBridgeUrl)" | URL-তুলনা Frame-Identity প্রমাণ করে না [VF ২.৭] | `WebViewCompat.addWebMessageListener` + `allowedOriginRules={"https://arena.ai","https://www.arena.ai"}` + `isMainFrame` যাচাই; `addJavascriptInterface` পর্যায়ক্রমে অপসারিত (ADR-013) |
| Layer 2 — "EncryptedCredentialVault (Keystore AES-256-GCM)" | `security-crypto`/`MasterKey` Deprecated [VF ২.৫] | `KeystoreCredentialVault` — প্ল্যাটফর্ম `KeyStore` + `Cipher AES/GCM/NoPadding` (ADR-009-R1) |
| Layer 2 — (অনুপস্থিত) | Native Capability-র Authorization নেই | নতুন **`CapabilityBroker`** (৪.৩.২, ১৩.৪) |
| Layer 3 — `OfficialSandboxSyncEngine` | Stream/DOM Capture অপ্রমাণিত [UA] | **Conditional** — Tiered Capture + Hash-Verified Ingest (৬.৪) |
| Layer 3 — (অনুপস্থিত) | Model-বৈচিত্র্য সামলানোর স্তর নেই | নতুন **`ModelCapabilityRegistry` + `AgentLoopController` + `ToolCallValidator`** (৫.৪) |
| Layer 4 — `filesDir/databases/` (§৮.১) | Room DB `filesDir`-এ থাকে না; থাকে `context.getDatabasePath()` (`/data/data/<pkg>/databases/`) | পথ সংশোধিত (৮.১ Errata) |
| Layer 4 — `WorkspaceFileSystem` একমাত্র মাস্টার | Uninstall/Clear Data-এ হারায় [VF ২.২] | ৩-স্তর Storage + পরিস্থিতিভিত্তিক Source-of-Truth (৮.৫–৮.৭) |
| Layer 5 — `ap-stream-hook.js` / `ap-sandbox-observer.js` | Tool-event Format ও CodeMirror সিলেক্টর অজানা [UA] | **Experimental Adapter**; Feature-flagged; PoF-S1…S12 পাস না করলে `Verified` নয় |

#### ৪.৩.১ R1 Storage ও Capture-এর সমন্বিত ভিউ [PD]

```
 ┌───────────── ARENA CLOUD (Official Sandbox — একমাত্র Execution Environment) ─────────────┐
 │  create_file / edit_file / bash(run_command) …     (ArenaPilot এখানে কিছুই চালায় না)   │
 └───────┬───────────────────────────────────────────────────────────────▲─────────────────┘
         │ Tier A: Stream events  Tier B: DOM  Tier C: Sandbox-side hash   │ Hydration (Model-mediated,
         │ (সব [UA] — PoF)         manifest via model-run `sha256sum`      │ Hash-verified; Export Pack)
         ▼                                                                │
 ┌─────────────── WebView (arena.ai) — Untrusted Content ─────────────────┴───────────────┐
 │  ap-*.js adapters (Untrusted-by-default output)  ──addWebMessageListener──►  Broker     │
 └───────────────────────────────────────┬────────────────────────────────────────────────┘
                                         ▼
 ┌─ CapabilityBroker (Authorize · Validate · Scope · Consent · Audit) ────────────────────┐
 └──┬──────────────┬───────────────┬──────────────────┬───────────────────┬───────────────┘
    ▼              ▼               ▼                  ▼                   ▼
 SyncIngest   GitHubAgent    FileAnalysis       KeystoreCredential   BackupEngine
 (Verify→Stage→Commit)       Engine             Vault                (Encrypted .apbackup)
    ▼
 ┌─ STORAGE LAYERS ───────────────────────────────────────────────────────────────────────┐
 │ L1 Internal Working: Room DB + CAS Blob Store + Workspace tree   (Uninstall/Clear ⇒ হারায়) │
 │ L2 User-Owned (SAF Tree URI): Project Mirror ফোল্ডার    (Uninstall-এ থাকে; Grant হারাতে পারে) │
 │ L3 Export/Backup: Encrypted .apbackup (SAF/Share)         (ব্যবহারকারীর নিয়ন্ত্রণে, Portable)   │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

#### ৪.৩.২ নতুন/সংশোধিত Component-এর দায়িত্ব
- **`CapabilityBroker`:** WebView→Native প্রতিটি অনুরোধের একমাত্র প্রবেশপথ; Capability-ভিত্তিক Allowlist, Schema-Validation, Scope-Binding (projectId/conversationId), User-Consent Gate, Audit Log।
- **`SyncIngest`:** Capture করা প্রতিটি ফাইল-ইভেন্টকে `Candidate → Verified → Committed` পাইপলাইনে পাঠায় (৬.৫); Verified না হলে Working Tree আপডেট হয় না।
- **`ModelCapabilityRegistry`/`AgentLoopController`/`ToolCallValidator`:** ৫.৪।
- **`BackupEngine`:** ৮.৯-এর Encrypted Portable Backup ও Crash-safe Resume।

---

## 5. চারটি Direct Mode-এর পূর্ণাঙ্গ আচরণ ও স্পেসিফিকেশন (Text, Code, Search, Image)

### ৫.১ মোড শনাক্তকরণ ও স্থায়িত্ব (Modality Detection & Persistence)
- **রুট ও রিকোয়েস্ট ম্যাপিং:**
  - `/text/direct` → `modality = "chat"` (`DirectMode.TEXT`)
  - `/code/direct` → `modality = "webdev"` (`DirectMode.CODE`)
  - `/search/direct` → `modality = "search"` (`DirectMode.SEARCH`)
  - `/image/direct` → `modality = "image"` (`DirectMode.IMAGE`)
- **সেশন স্থায়িত্ব (`/c/{conversationId}`):**
  v2.4.0-এর একটি বড় ত্রুটি ছিল যে কথোপকথন শুরু হওয়ার পর URL যখন `/c/{id}` হয়ে যায়, তখন পেজ রিলোড হলে অ্যাপ বুঝতে পারত না এটি কোন মোডের চ্যাট। V3-তে `create-evaluation` কল হওয়ার সাথে সাথে `conversations` টেবিলে `(conversationId, modality, modelId, projectId)` সংরক্ষিত হবে। ফলে `/c/{id}` রিলোড বা ক্র্যাশ রিকভার হলেও সঠিক মোড (`TEXT`, `CODE`, `SEARCH`, বা `IMAGE`) ১০০% নির্ভুলভাবে পুনরুদ্ধার হবে।

### ৫.২ চারটি মোডের দায়িত্ব বিভাজন ম্যাট্রিক্স (Mode Capability & Layer Matrix)

| সক্ষমতা (Capability) | Text Mode (`/text/direct`) | Code Mode (`/code/direct`) | Search Mode (`/search/direct`) | Image Mode (`/image/direct`) | কোথায় বাস্তবায়িত (Layer) |
|---|---|---|---|---|---|
| **App System Instructions** | সক্রিয় (Text Playbook) | সক্রিয় (Code & Official Sandbox Playbook) | সক্রিয় (Search & Verification Playbook) | **সম্পূর্ণ বন্ধ (`inject: false`)** | `ModeOrchestrator` + `ap-context-injector.js` |
| **Office Skill (`SheetJS`/`docx`)** | কেবল স্পষ্ট ডকুমেন্ট তৈরির নির্দেশনায় (Word-boundary + Intent match) | **বন্ধ** (যাতে কোডিং প্রম্পট দূষিত না হয়) | **বন্ধ** | **বন্ধ** | `ModeOrchestrator` |
| **Memory Injection & Capture** | সক্রিয় (Global + Active Project Memory) | সক্রিয় (Global + Active Project Coding Conventions) | সক্রিয় (Read-only Global Memory) | **সম্পূর্ণ বন্ধ** | `MemoryEngine` (Room DB) |
| **Project Context & Files** | সক্রিয় (BM25 প্রাসঙ্গিক অংশ) | সক্রিয় (Repo Tree + Active Task State + Sync Manifest) | ঐচ্ছিক (যদি প্রজেক্ট যুক্ত থাকে) | **সম্পূর্ণ বন্ধ** | `ProjectEngine` + `WorkspaceFileSystem` |
| **Code Execution Sandbox** | ব্রাউজার JS রানার বা ডকুমেন্ট জেনারেটর | **Arena Official Cloud Sandbox (একমাত্র এক্সিকিউশন ইঞ্জিন)** | কেবল ডেটা পার্সিং/হিসাবের জন্য ব্রাউজার রানার | **বন্ধ** | Arena Official Sandbox + `OfficialSandboxSyncEngine` |
| **GitHub Integration** | রিড-অনলি রেফারেন্স (ঐচ্ছিক) | **পূর্ণাঙ্গ (Clone/Tree, Edit, Diff, Commit, Push, PR, CI)** | বন্ধ | বন্ধ | `GitHubAgentEngine` (Native Kotlin) |
| **File Upload & Analysis** | Image, PDF, DOCX, XLSX, PPTX, CSV, ZIP, Code, Text | মাল্টি-ফাইল সোর্স কোড, ফোল্ডার, ZIP, এরর লগ, UI স্ক্রিনশট | PDF, প্রবন্ধ, ডেটাসেট, ওয়েব স্ন্যাপশট | রেফারেন্স ইমেজ আপলোড (`input[type=file]`) | `FileAnalysisEngine` + `NativeBlobStore` |
| **Post-Generation Artifacts** | ডকুমেন্ট ডাউনলোড (`DOCX`, `XLSX`, `PPTX`), চার্ট, HTML ভিজ্যুয়ালাইজার | **Automatic Sandbox-to-Device File Sync**, Diff Viewer, ZIP/Folder Export | সাইটেশন কার্ড, সোর্স আর্কাইভ, ক্রস-চেক রিপোর্ট | **Native Image Gallery**, অটো-সেভ, প্রম্পট হিস্ট্রি, রি-ইউজ ও শেয়ার | Native Storage + Mode Sheets |

---

### ৫.৩ প্রতিটি মোডের বিস্তারিত আচরণ (Mode-by-Mode Specification)

#### A. Text Mode (`/text/direct` — `modality: "chat"`)
- **উদ্দেশ্য:** দৈনন্দিন সাধারণ কথোপকথন, গভীর বিশ্লেষণ, ডকুমেন্ট তৈরি, ফাইল বিশ্লেষণ, প্রজেক্ট পরিচালনা এবং বাহ্যিক MCP টুল ব্যবহার।
- **আচরণ ও প্রম্পট নিয়ম:**
  - ব্যবহারকারীর ভাষায় উত্তর প্রদান, অনুমান না করে টুল দিয়ে তথ্য যাচাই।
  - সংরক্ষিত মেমরি (যদি ব্যবহারকারী অপ্ট-ইন করেন) এবং সক্রিয় প্রজেক্টের ফাইল/নির্দেশনা স্বয়ংক্রিয়ভাবে প্রাসঙ্গিকতা অনুযায়ী যুক্ত হবে।
  - **সংশোধিত Office Skill ট্রিগার:** কেবল তখনই `DOCX`/`XLSX`/`PPTX` লাইব্রেরি রেফারেন্স যুক্ত হবে যখন ব্যবহারকারী স্পষ্টভাবে ফাইল তৈরির অনুরোধ করবেন (যেমন `.xlsx`, `.docx`, `.pptx`, `"create an excel"`, `"এক্সেল ফাইল বানাও"`, `"ওয়ার্ড ফাইল তৈরি করো"`)—সাধারণ `"document"` বা `"report"` শব্দের কারণে কখনোই নয়।
  - ভিজ্যুয়াল আউটপুটের জন্য `APH:VISUALIZER` (সেলফ-কন্টেইনড ইন্টারেক্টিভ HTML/SVG) ও `APH:chart` (Vega-Lite) রেন্ডার হবে।

#### B. Code Mode (`/code/direct` — `modality: "webdev"`)

> **R1 [UA]:** নিচের Tool-তালিকা (`bash`, `read_file`, `delete_file`, `list_files`, `glob_files`, `grep_files`, `web_search`, `web_fetch`) `/code/direct`-এর জন্য **অপ্রমাণিত** (§২.১.১)। Arena-র Official Blog শুধু `create_file`, `edit_file`, `read_file`, `run_command` উল্লেখ করে। Playbook Live Session-এ পর্যবেক্ষিত Tool-সেটের ওপর ভিত্তি করে লিখতে হবে (PoF-S1)। `PLAN.md`/`PROGRESS.md` **Convention** — Sync-এর নির্ভরযোগ্য উৎস নয়।
- **উদ্দেশ্য:** পূর্ণাঙ্গ এজেন্টিক সফটওয়্যার ডেভেলপমেন্ট ওয়ার্কস্পেস।
- **আচরণ ও প্রম্পট নিয়ম:**
  - `sd-site.js`-এর পুরোনো `"Deliver one index.html with inline CSS/JS"` এবং লোকাল `sandbox://linux` প্রম্পট সম্পূর্ণভাবে প্রতিস্থাপিত হবে।
  - নতুন **V3 Code Mode Playbook** মডেলকে নির্দেশ দেবে:
    1. Arena-এর **Official Code Sandbox**-এর নিজস্ব টুল (`read_file`, `create_file`, `edit_file`, `delete_file`, `list_files`, `glob_files`, `grep_files`, `bash`, `web_search`, `web_fetch`) ব্যবহার করে মাল্টি-ফাইল প্রজেক্ট তৈরি, রিফ্যাক্টর, টেস্ট (`npm test`, `pytest`, `gradlew`, `cargo test`), লিন্ট ও বিল্ড করতে।
    2. প্রতিটি পরিবর্তনের পর স্যান্ডবক্সে প্রকৃত কমান্ড চালিয়ে আউটপুট ও এরর লগ যাচাই করতে এবং এরর থাকলে মূল কারণ (Root Cause) সমাধান করে পুনরায় পরীক্ষা করতে।
    3. দীর্ঘমেয়াদি কাজের জন্য ওয়ার্কস্পেসে `PLAN.md` ও `PROGRESS.md` হালনাগাদ রাখতে, যা ArenaPilot-এর `OfficialSandboxSyncEngine` স্বয়ংক্রিয়ভাবে Android ডিভাইসের স্টোরেজে সংরক্ষণ করবে।
    4. সংযুক্ত GitHub রিপোজিটরির জন্য ArenaPilot-এর নেটিভ GitHub টুল/ব্রিজ ব্যবহার করে ব্রাঞ্চ, কমিট, পুশ এবং PR পরিচালনা করতে।

#### C. Search Mode (`/search/direct` — `modality: "search"`)
- **উদ্দেশ্য:** লাইভ ওয়েব সার্চ, ওয়েব পেজ ফেচ, ফ্যাক্ট-চেকিং, সাইটেশন নিষ্কাশন ও গবেষণা।
- **আচরণ ও সক্ষমতা:**
  - **Native + Arena Hybrid Search:** Arena-এর নিজস্ব লাইভ সার্চ সক্ষমতার পাশাপাশি ArenaPilot-এর নেটিভ `WebFetch & Readability Engine` (`bds-fetch-url` V3) থাকবে, যা যেকোনো URL থেকে মূল আর্টিকেল, টেবিল ও মেটাডেটা (`title`, `author`, `publishedDate`, `canonicalUrl`) পরিষ্কার Markdown হিসেবে নিষ্কাশন করবে।
  - **Source Extraction & Citation Ledger:** প্রতিটি উত্তরে ব্যবহৃত উৎসের তালিকা (`[1] Title — domain.com`) থেকে স্বয়ংক্রিয়ভাবে একটি নেটিভ **Sources & Citations Sheet** তৈরি হবে, যেখানে ব্যবহারকারী প্রতিটি লিংক যাচাই করতে, মূল পেজ প্রিভিউ করতে এবং প্রজেক্টে রেফারেন্স হিসেবে সেভ করতে পারবে।
  - **Cross-Checking Protocol:** গুরুত্বপূর্ণ তথ্য বা দাবির ক্ষেত্রে অন্তত দুটি স্বাধীন ও প্রাথমিক উৎস (Official Documentation, Primary Spec, Peer-reviewed বা সরকারি উৎস) মিলিয়ে দেখা বাধ্যতামূলক থাকবে; তথ্যের অমিল থাকলে উভয় মতামত স্পষ্টভাবে উল্লেখ করতে হবে।

#### D. Image Mode (`/image/direct` — `modality: "image"`)
- **উদ্দেশ্য:** ইমেজ জেনারেশন, প্রম্পট ব্যবস্থাপনা, জেনারেটেড ছবির স্থায়ী সংরক্ষণ ও গ্যালারি।
- **কঠোর প্রম্পট বিশুদ্ধতা (Zero Prompt Contamination Guarantee):**
  - `modality === "image"` হলে `ap-context-injector.js` এবং `injected.js` **কোনো অবস্থাতেই** ব্যবহারকারীর মেসেজে `<ArenaPilot>`, সিস্টেম প্রম্পট, মেমরি, প্রজেক্ট কনটেক্সট, তারিখ/সময় বা স্কিল টেক্সট যুক্ত করবে না। ব্যবহারকারী যা টাইপ করবেন, ঠিক সেই অক্ষরগুলোই অপরিবর্তিত অবস্থায় ইমেজ মডেলে যাবে।
- **Native Image Mode Features:**
  1. **Prompt Studio (Optional Non-Intrusive Helper):** কমপোজারের পাশে একটি ছোট নেটিভ আইকন থাকবে যেখানে ব্যবহারকারী নিজের পছন্দের প্রম্পট টেমপ্লেট, অ্যাসপেক্ট রেশিও নোট বা প্রম্পট হিস্ট্রি সংরক্ষণ ও পুনরায় ব্যবহার করতে পারবেন (কেবল ব্যবহারকারী ট্যাপ করলেই কমপোজারে বসবে, স্বয়ংক্রিয়ভাবে কিছু যুক্ত হবে না)।
  2. **Automatic Generated Image Capture & Native Gallery:**
     - ইমেজ মডেল যখন ছবি তৈরি করে পেজে রেন্ডার করে (`<img>` বা স্ট্রিমের ইমেজ আর্টিফ্যাক্ট URL), তখন `ap-stream-hook.js` / DOM অবজারভার সেই ছবির পূর্ণ রেজোলিউশন বাইটস ক্যাপচার করে `WebViewBridge.saveGeneratedImage()`-এ পাঠাবে।
     - ছবিটি স্বয়ংক্রিয়ভাবে ডিভাইসের অভ্যন্তরীণ গ্যালারি (`filesDir/gallery/<YYYY-MM>/<imageId>.png`) এবং রুম ডাটাবেসের `generated_images` টেবিলে `(id, conversationId, modelName, exactPrompt, localPath, width, height, createdAt)` হিসেবে সংরক্ষিত হবে।
  3. **Post-Generation Actions:** নেটিভ গ্যালারি ভিউ থেকে এক ট্যাপে:
     - ফোনের পাবলিক `Pictures/ArenaPilot` (`MediaStore.Images`) ফোল্ডারে এক্সপোর্ট,
     - প্রম্পট কপি ও পুনরায় ব্যবহার (Remix Prompt),
     - কোনো নির্দিষ্ট Project-এর অ্যাসেট ফোল্ডারে (`assets/`) ছবিটি যুক্ত করা,
     - অন্য অ্যাপে শেয়ার করা (`Intent.ACTION_SEND`)।

### ৫.৪ Model Compatibility ও Agent Protocol Architecture (R1 সংযোজন)

**মূল নীতি [PD]:** ArenaPilot কোনো মডেলকে তার **প্রদর্শিত (Measured) সক্ষমতার বাইরে** কাজ করতে বাধ্য করবে না। "Tool Call করতে পারে" ≠ "নির্ভরযোগ্য Agentic Coder"। প্রতিটি সক্ষমতা আলাদাভাবে পরিমাপ করে Registry-তে সংরক্ষিত হবে।

> **[VF] প্রেক্ষাপট:** Arena একটি Model Catalog (`GET /nextjs-api/model-catalog`) প্রকাশ করে যাতে প্রতিটি মডেলের `capabilities.inputCapabilities/outputCapabilities` (text/image/video; `requiresUpload`) আছে — এটি **Modality** তথ্য দেয়, **Tool/Agentic ক্ষমতা নয়**। (বাস্তব Fetch: `arena.ai/code/direct` HTML-এ এমবেডেড Catalog-এ এই Field-গুলো দেখা গেছে, ২০২৬-১১-১৮।) Tool-Protocol ও Instruction-Following তথ্য Catalog-এ নেই → ArenaPilot-কে নিজে পরিমাপ করতে হবে।

#### ৫.৪.১ Model Identity ও Modality Detection
1. **Identity:** `modelId` (Catalog UUID), `publicName`, `organization`, Direct-Mode-এ নির্বাচিত মডেল শনাক্তকরণ — Source: Catalog + পেজের Model-Selector DOM (Selector [UA] → PoF-M1)। শনাক্ত না হলে `UNKNOWN_MODEL` → সর্বনিম্ন সক্ষমতা প্রোফাইল (Text-Tag Protocol বন্ধ, কোনো Auto-Agent Loop নয়)।
2. **Modality:** Catalog থেকে Input (text/image/…)/Output (text/image/video)। Image-Output মডেল → Image Mode নীতি (Zero Injection); Image-Input অক্ষম মডেলে ছবি Attach নিষিদ্ধ ও ব্যবহারকারীকে বার্তা।

#### ৫.৪.২ Model Capability Registry (`model_capabilities` টেবিল, ১২.৩)
প্রতি `(modelId, harnessVersion, surface)` জন্য Measured Fields:

| Capability | মান | কীভাবে পরিমাপ |
|---|---|---|
| `toolProtocol` | `OFFICIAL_STRUCTURED` · `TEXT_TAG` · `NONE` | Probe Suite P1 (৫.৪.১১) |
| `tagFidelity` | 0–1 (Well-formed Tag %) | ৫০-Probe Run |
| `argSchemaAccuracy` | 0–1 | Schema Validator পাস-হার |
| `editPrecision` | 0–1 | `edit_file` Exact-match সফলতা |
| `multiStepReliability` | Task-Completion % (Repo Task Suite, ৫.৪.১১) | Real Repository Tasks |
| `longContextBudgetTokens` | বাস্তব ব্যবহারযোগ্য (Advertised নয়) | Needle/Recall Probe |
| `streamStability` | Truncation/`finishReason=length` হার | Run Log |
| `stopHonored` | bool | Cancel Probe |
| `trustTier` | `T0 chat-only` · `T1 assisted` · `T2 supervised-agent` · `T3 autonomous-agent` | Matrix থেকে নির্ধারিত (৫.৪.১১) |
| `measuredAt`, `evidenceRunId` | তারিখ/Run | অনির্ধারিত হলে `UNMEASURED` |

**নিয়ম:** `UNMEASURED` মডেল = `T1` (ব্যবহারকারী অনুমোদনসহ প্রতিটি Tool-Step)। ব্যবহারকারী ম্যানুয়ালি Trust বাড়াতে পারে, কিন্তু UI-তে "Unverified for agentic work" Badge থাকবে।

#### ৫.৪.৩ Tool Protocol Compatibility — Structured বনাম Text-Tag
| ধরন | বর্ণনা | ঝুঁকি |
|---|---|---|
| **Official Structured Tool Call** (Arena নিজস্ব Sandbox-এ মডেল যা সরাসরি Call করে) | ArenaPilot **Protocol-এর মালিক নয়**; কেবল পর্যবেক্ষক। Tool Schema/Result Arena নিয়ন্ত্রণ করে | Wire-Format অজানা/পরিবর্তনশীল [UA] |
| **ArenaPilot Text-Tag** (`<APH:…>` — ArenaPilot-এর নিজস্ব Native Tool, যেমন GitHub/Local File Read) | মডেল Prose-এ Tag লেখে; ArenaPilot পার্স করে | Prompt Injection, Malformed Tag, Over-trigger |

**R1 নিয়ম:** (ক) Official Tool Call-কে ArenaPilot **কখনো পুনরায় Execute করবে না** — শুধু Observe/Record (Official Sandbox-ই Execution)। (খ) ArenaPilot-এর Text-Tag Tool-গুলো (GitHub, Local-file, Memory) একটি **Versioned Protocol `APH/1`**-এ একত্রিত; `<AP:…>` ও `<APH:…>` Namespace মিশ্রণ বন্ধ। (গ) Text-Tag কেবল `toolProtocol ∈ {TEXT_TAG}` সক্ষম মডেলে Prompt-এ ঘোষিত হবে।

#### ৫.৪.৪ Tool Call Validation (Pre-Execution)
প্রতিটি Native Tool Call পাস করবে: ① **Syntax** (সম্পূর্ণ Closing Tag/JSON); ② **Schema** (Type, Required, Length Limit — Unknown Field প্রত্যাখ্যাত); ③ **Scope** (projectId-বাউন্ড Path, `..`/Absolute Path নিষিদ্ধ); ④ **Policy** (Capability + Consent, ১৩.৪); ⑤ **Idempotency Key** (`conversationId:turnIndex:callIndex` — Duplicate Stream/Retry-তে দ্বিতীয়বার Execute নয়)। যেকোনো ধাপে ব্যর্থ ⇒ Execute নয়, `INVALID_TOOL_CALL` Audit-সহ।

#### ৫.৪.৫ Malformed/Invalid Tool Call Recovery
1. Truncated/Unclosed Tag (`finishReason=length` বা Stream-Drop) ⇒ **কখনো আংশিক Tag Execute নয়**। Bounded Continue (সর্বোচ্চ ২ বার; "পূর্ণ Tool Call পুনরায় পাঠাও"), না হলে ব্যবহারকারীকে জানানো।
2. Schema-ব্যর্থ ⇒ Validation Error মডেলকে ফেরত (সর্বোচ্চ ২ Repair Attempt); এরপর `PAUSED_NEEDS_USER`।
3. একই ব্যর্থ Call-এর Loop শনাক্ত (Same Hash ৩ বার) ⇒ Loop Breaker ও `trustTier` Downgrade প্রস্তাব।

#### ৫.৪.৬ Context Budget ও Token Limit
- `ContextBudgeter` প্রতিটি Outbound Turn-এর আগে হিসাব করে: System/Playbook + Memory + Project Context + Attachments + History। বাজেট = `min(Registry.longContextBudgetTokens × 0.6, UI-নির্ধারিত সীমা)`; Tokenizer মডেল-নির্ভর ও অজানা ⇒ **Conservative Estimate** (≈ chars/3, সংরক্ষণশীল) [UA]; Measured Calibration PoF-M3।
- অগ্রাধিকার: User Prompt > Active Task State (PLAN/PROGRESS) > Directly Relevant Files > Memory(always) > History Summary।
- Image Mode: কোনো Context যোগ হয় না (Zero Injection)।

#### ৫.৪.৭ Multi-Step Agent Loop, Stop ও Cancellation
- **Loop State Machine** (১৪.১-এর সম্প্রসারণ): `IDLE → PLAN → ACT(observe/Native Tool) → VERIFY → (ACT | DONE | PAUSED_*)`। প্রতিটি `ACT`-এর পরে **Result Verification** (৫.৪.৯) বাধ্যতামূলক।
- **Hard Limits:** সর্বোচ্চ Step, সর্বোচ্চ Auto-Continue (২), সর্বোচ্চ Wall-clock; Foreground Service সহ Stop Action।
- **Stop/Cancel:** Stop চাপলে ① Page-এর নিজস্ব Stop Control Trigger (Selector [UA]), ② ArenaPilot-এর Pending Native Tool Cancel, ③ Idempotency ফ্ল্যাগ `CANCELLED`, ④ Partial Capture "UNVERIFIED"-এ Quarantine। **Official Sandbox-এ ইতিমধ্যে চলা `bash` Cancel করা ArenaPilot-এর ক্ষমতার বাইরে [KL]।** `stopHonored` পরিমাপ PoF-M5।

#### ৫.৪.৮ Rate Limit, Retry ও Fallback
- 429/Network Drop ⇒ Exponential Backoff + Jitter (সর্বোচ্চ ৩); ব্যবহারকারীকে Countdown দেখানো। Arena-র Daily Credit/Rate সীমা [UA] — Hard-code নয়।
- **Capability-অনুযায়ী Fallback:** `T3→T2→T1→T0` ক্রমে Autonomy কমানো (যেমন: Malformed Rate > ১০% ⇒ প্রতিটি Step-এ Confirmation); ফাইল-Edit ব্যর্থ ⇒ "Show Diff & Ask"; Tool অক্ষম ⇒ পরিকল্পনা-শুধু (Chat-only) মোড। **Execution Environment Fallback হিসেবে অন্য Sandbox নয়।**

#### ৫.৪.৯ Tool Execution-এর আগে ও পরে Result Verification
| ধাপ | আগে (Pre) | পরে (Post) |
|---|---|---|
| Native File Read/Write | Path Scope, Hash-of-base (Optimistic Concurrency) | Read-back + SHA-256 মিল |
| Official Sandbox পর্যবেক্ষণ | — | Tier C Hash Manifest মিল (৬.৪); না মিললে `UNVERIFIED` |
| GitHub Commit | Base SHA/Branch Head পুনঃপাঠ | `GET ref` → Head == নতুন Commit SHA; Tree Diff == প্রত্যাশিত |
| Build/Test দাবি ("tests pass") | — | মডেলের দাবি যথেষ্ট নয়; Sandbox Command Exit-code Tool Result থেকে (পাওয়া গেলে) নতুবা "Unverified claim" লেবেল |

#### ৫.৪.১০ Model Switch ও Task Resume
- Model বদল ⇒ বর্তমান Turn Atomic শেষ/বাতিল; `task_checkpoints` থেকে **Model-নিরপেক্ষ Resume Packet** (Plan, Progress, Verified File Manifest, Open Questions) তৈরি; নতুন মডেলের `trustTier` ও Context Budget অনুযায়ী ছাঁটা। নতুন মডেল পূর্ববর্তী মডেলের Raw Tool Tag **অনুসরণ করবে না** — শুধু Verified State।
- নিম্নতর Tier-এর মডেলে Switch ⇒ UI-তে সতর্কতা ও Autonomy হ্রাস।

#### ৫.৪.১১ Compatibility Matrix তৈরির পদ্ধতি ও Acceptance Criteria [PoF-M1…M6]
1. **Probe Suite (সংক্ষিপ্ত, প্রতি মডেল):** P1 Tag Fidelity (৫০ Run), P2 Schema Accuracy, P3 Edit Precision (Exact-match 30 Edit), P4 Truncation/Continue, P5 Stop Probe, P6 Long-Context Recall।
2. **Repository Task Suite (প্রকৃত Code Task):** ≥ ১০টি বাস্তব Repository Task (ছোট Bug-fix, ২–৫ ফাইল Refactor, Test যোগ, Build ঠিক করা, GitHub Branch+PR-প্রস্তুতি), প্রতিটি ≥ ৩ বার চালিয়ে; Pass = Hidden Test/Build সবুজ **এবং** Diff Review-তে অনির্ধারিত ফাইল পরিবর্তন নেই।
3. **Tier নির্ধারণ (Acceptance Criteria):**
   - `T3 autonomous-agent`: Tag/Schema ≥ ৯৯%, Repository Task Pass ≥ ৮০% (৩ রানের মধ্যে ≥ ২), Loop/Overrun ঘটনা ০, Stop সম্মানিত।
   - `T2 supervised-agent`: Tag/Schema ≥ ৯৫%, Task Pass ≥ ৫০%।
   - `T1 assisted`: যা কিছু বাকি, প্রতিটি Step-এ ব্যবহারকারী অনুমোদন।
   - `T0 chat-only`: Tool Protocol ব্যর্থ।
   *(শতাংশ-সীমাগুলো **[PD] প্রারম্ভিক প্রস্তাব**; Phase 0-এর প্রথম Baseline Run-এর পর পুনর্নির্ধারণযোগ্য — কৃত্রিম বা অনুমিত Benchmark নয়।)*
4. **Matrix পুনর্পরিমাপ Trigger:** Arena UI/Stream পরিবর্তন শনাক্ত, Model Version বদল, বা ৯০ দিন অতিক্রান্ত।
5. ফলাফল `model_capabilities`-এ ও `docs`-এর বাইরে Machine-readable `compat-matrix.json`-এ (Repository-র CI-তে Schema-যাচাই) — **এই Revision-এ কোনো ফাইল তৈরি হয়নি**।

---

## 6. Code Mode (সর্বোচ্চ অগ্রাধিকার): Official Sandbox ও Persistent Storage সমন্বয়

> **R1 Status — Conditional:** §৬.১–৬.২ (V3 Draft) নকশার উদ্দেশ্য হিসেবে রাখা হলো; এর অনেক অনুমান **অপ্রমাণিত** (§৬.৩)। **নরমেটিভ নকশা §৬.৩–৬.১০।** কোনো PoF (S1–S12) সম্পন্ন হয়নি।

### ৬.১ বাধ্যবাধকতা ও মৌলিক সমস্যা বিশ্লেষণ
- **বাধ্যবাধকতা:** Arena.ai-এর Code Mode-এ বিদ্যমান **Official Cloud Sandbox**-ই হবে একমাত্র কোড এক্সিকিউশন পরিবেশ। অ্যাপের ভেতরের পুরোনো লোকাল PRoot/Alpine Linux স্যান্ডবক্স (`Sandbox.kt`, `SandboxTools.kt`, `libproot.so`, `StudioActivity.kt`) কোড এক্সিকিউশনের জন্য আর ব্যবহৃত হবে না।
- **মৌলিক সমস্যা:**
  1. অফিসিয়াল স্যান্ডবক্স Arena.ai-এর ক্লাউড সার্ভারে চলে, তাই সেটি সরাসরি Android-এর লোকাল ফাইল সিস্টেমে প্রবেশ করতে পারে না।
  2. অফিসিয়াল স্যান্ডবক্সের সেশন এক্সপায়ার বা রিসেট হলে ক্লাউড কন্টেইনারের ভেতরে তৈরি করা ফাইল ও কাজের অগ্রগতি হারিয়ে যেতে পারে।
  3. ব্যবহারকারী যখন নতুন সেশনে বা রিসেট হওয়া স্যান্ডবক্সে কাজ শুরু করে, তখন স্থানীয় Android স্টোরেজে থাকা প্রজেক্ট ফাইলগুলো আবার অফিসিয়াল স্যান্ডবক্সে পৌঁছে দেওয়ার ব্যবস্থা থাকতে হবে।

### ৬.২ সমাধান: Tri-Channel Official Sandbox ⇄ Android Persistent Storage Bridge

> **R1:** এই সাব-সেকশন **Proposed/Conditional Design Intent**; "দেখা মাত্রই/রিয়েল-টাইমে/সম্পূর্ণ কন্টেন্ট" শব্দগুলো প্রমাণিত নয়। Channel ৩-এর "Sandbox-`bash`-এ Token-সহ Push" **নিষিদ্ধ** (§১৩.৬ #8)। প্রতিস্থাপক: §৬.৪।

ArenaPilot V3-তে Android Native Storage (`WorkspaceFileSystem`) হবে **Source of Truth (স্থায়ী মাস্টার কপি)** এবং Arena-এর Official Sandbox হবে **Ephemeral Compute Engine (অস্থায়ী এক্সিকিউশন ইঞ্জিন)**। এই দুইয়ের মধ্যে ফাইল ও স্টেট আদান-প্রদানের জন্য তিনটি পরিপূরক চ্যানেল কাজ করবে:

```
+--------------------------------------------------------------------------------------------------+
|                        OFFICIAL SANDBOX <--> ANDROID PERSISTENT STORAGE                          |
|                                                                                                  |
|   [ARENA OFFICIAL CLOUD SANDBOX]                      [ANDROID NATIVE LAYER (ArenaPilot V3)]     |
|   (create_file, edit_file, bash,                      (WorkspaceFileSystem + Room SQLite +       |
|    CodeMirror 6, Live Preview)                         ArenaWorkspaceDocumentsProvider)          |
|                 |                                                       ^                        |
|                 |  CHANNEL 1: Real-Time Stream & DOM Artifact Capture   |                        |
|                 +------------------------------------------------------>|                        |
|                 |  - Intercepts every tool call (create_file/edit_file/ |                        |
|                 |    delete_file) & CodeMirror file buffers from stream |                        |
|                 |  - Auto-writes to filesDir/workspaces/<proj>/tree/    |                        |
|                 |  - Creates immutable turn snapshot (<turnId>)         |                        |
|                 |                                                       |                        |
|                 |<------------------------------------------------------+                        |
|                 |  CHANNEL 2: Workspace Hydration & Delta Sync          |                        |
|                 |  - On Sandbox Reset / New Chat / Local File Edit:     |                        |
|                 |    Builds compact Hydration Bundle (changed files +   |                        |
|                 |    PLAN.md + PROGRESS.md + TaskCheckpoint)            |                        |
|                 |  - Model applies bundle to Official Sandbox via its   |                        |
|                 |    native create_file / bash tools on Turn 1          |                        |
|                 |                                                       |                        |
|                 |<-------------------- CHANNEL 3 ---------------------->|                        |
|                 |        GitHub Repository & Branch Sync Bridge         |                        |
|                 |  - Official Sandbox (`bash` git/curl) <--> GitHub <-->|                        |
|                 |    Android Native `GitHubAgentEngine` (Git Data API)  |                        |
+--------------------------------------------------------------------------------------------------+
```

#### চ্যানেল ১: Real-Time Stream & DOM Artifact Capture (Sandbox → Android Storage)
যখনই Code Mode-এ মডেল অফিসিয়াল স্যান্ডবক্সে কাজ করে, তখন দুটি জায়গা থেকে ফাইল ও কমান্ডের তথ্য পেজে আসে:
1. **Network Stream Interceptor (`ap-stream-hook.js`):**
   `/nextjs-api/stream/create-evaluation` এবং `/nextjs-api/stream/post-to-evaluation/{id}` স্ট্রিমে মডেলের প্রতিটি টুল কল (`create_file`, `edit_file`, `delete_file`, `bash`) এবং তার আউটপুট প্রবাহিত হয়।
   - `create_file { path, content }` দেখা মাত্রই `ap-stream-hook.js` সেটি `AndroidBridge.syncSandboxFile(projectId, turnId, "CREATE", path, content)`-এ পাঠায়।
   - `edit_file { path, context, replacement }` দেখা মাত্রই নেটিভ ইঞ্জিন স্থানীয় কপিতে ফাজি/এক্স্যাক্ট প্যাচ প্রয়োগ করে এবং পরবর্তী CodeMirror সিঙ্কে পূর্ণ ফাইল মিলিয়ে নেয়।
   - `delete_file { path }` দেখা মাত্রই স্থানীয় ওয়ার্কিং ট্রি থেকে ফাইলটি মুছে স্ন্যাপশট হিস্ট্রিতে রেকর্ড রাখে।
   - `bash { command, description }` এবং এর `stdout`/`stderr`/`exitCode` দেখা মাত্রই `task_checkpoints` ও `sandbox_command_logs` টেবিলে সংরক্ষিত হয়।
2. **CodeMirror 6 & File-Tree DOM Observer (`ap-sandbox-observer.js`):**
   Arena-এর Code Mode UI-তে সোর্স কোড দেখার জন্য একটি ফাইল ট্রি এবং CodeMirror 6 এডিটর (`[data-code-block='true']`, `.cm-content`) রেন্ডার হয়। `ap-sandbox-observer.js` টার্ন শেষ হওয়ার সাথে সাথে বা ব্যবহারকারী "Sync Now" ট্যাপ করলে পেজের ফাইল ট্রি ও এডিটর বাফার থেকে সম্পূর্ণ ফাইল কন্টেন্ট সংগ্রহ করে Android স্টোরেজের ফাইলগুলোর SHA-256 হ্যাশের সাথে মিলিয়ে নেয়।

#### চ্যানেল ২: Workspace Hydration & Recovery Protocol (Android Storage → Official Sandbox)
যদি অফিসিয়াল স্যান্ডবক্স রিসেট হয়ে যায়, সেশন এক্সপায়ার করে, অথবা ব্যবহারকারী নতুন চ্যাটে পূর্ববর্তী প্রজেক্ট বা ডিভাইসের স্থানীয় ফাইল নিয়ে কাজ চালিয়ে যেতে চায়:
1. `OfficialSandboxSyncEngine` স্থানীয় প্রজেক্টের বর্তমান ফাইল ট্রি, `PLAN.md`, `PROGRESS.md`, সর্বশেষ `TaskCheckpoint`, এবং পরিবর্তিত ফাইলগুলোর একটি **Hydration Bundle** তৈরি করে।
2. যখন ব্যবহারকারী নতুন মেসেজ পাঠায় (অথবা **"Restore Workspace to Sandbox"** বাটনে ট্যাপ করে), তখন `ap-context-injector.js` মেসেজের শুরুতে একটি স্ট্রাকচার্ড `<AP:WORKSPACE_HYDRATION>` ব্লক যুক্ত করে দেয়:
   - ছোট ও মাঝারি প্রজেক্টের ক্ষেত্রে (≤ ১০০ KB টেক্সট): প্রজেক্টের ফাইল ট্রি এবং প্রয়োজনীয় ফাইলগুলোর পূর্ণ কন্টেন্ট সংযুক্ত থাকে, সাথে স্পষ্ট নির্দেশনা থাকে: *"The official sandbox was reset or this is a resumed session. First restore these workspace files into the sandbox using your file/bash tools, then continue from Step X of PROGRESS.md."*
   - বড় প্রজেক্টের ক্ষেত্রে (> ১০০ KB বা বহু ফাইল): সম্পূর্ণ ফাইল ট্রি (`fileTree`), `PLAN.md`, `PROGRESS.md`, এবং সক্রিয় টাস্কের সাথে সরাসরি সম্পর্কিত ফাইলগুলো (Smart Context Packing) প্রথমে দেয়; বাকি ফাইলগুলো মডেল যেকোনো মুহূর্তে `<AP:LOCAL_FILE_READ path="src/..." />` ট্যাগ লিখে Android স্টোরেজ থেকে স্বয়ংক্রিয়ভাবে পড়ে নিতে পারে!

#### চ্যানেল ৩: GitHub Cloud-to-Device Sync Bridge (Large Codebases)
যখন কোনো Code Project একটি GitHub রিপোজিটরির সাথে যুক্ত থাকে:
- Android ডিভাইসের `GitHubAgentEngine` সরাসরি GitHub API-এর মাধ্যমে ফাইল ট্রি সিঙ্ক, ব্রাঞ্চ তৈরি ও কমিট পুশ করতে পারে।
- একইভাবে অফিসিয়াল স্যান্ডবক্সের ভেতরে থাকা `bash` টুলও (ব্যবহারকারীর অনুমোদিত ক্ষণস্থায়ী হেডার বা ব্রিজ কমান্ডের মাধ্যমে) অথবা Android-এর `GitHubAgentEngine` অফিসিয়াল স্যান্ডবক্স থেকে সংগৃহীত পরিবর্তিত ফাইলগুলো সরাসরি GitHub ব্রাঞ্চে অ্যাটমিক কমিট হিসেবে পুশ করে দেয়। ফলে স্যান্ডবক্স রিসেট হলেও ১টি ক্লিকেই GitHub ও Android স্টোরেজ থেকে পুরো স্টেট ফিরে আসে।

### ৬.৩ Revision R1 — Sync Architecture-এর অনুমান-অডিট (কোনো অনুমান "Fact" নয়)

> **Status (পুরো §৬.২ Tri-Channel-এর):** `Conditional`। §৬.২-এর Diagram ও Channel-বর্ণনা **নকশার উদ্দেশ্য (Design Intent)** হিসেবে রাখা হয়েছে; এতে "দেখা মাত্রই", "সম্পূর্ণ কন্টেন্ট সংগ্রহ", "রিয়েল-টাইমে" ইত্যাদি শব্দ **প্রমাণিত নয়**। §৬.৩–৬.১০ নরমেটিভ। বিরোধ থাকলে ৬.৩–৬.১০ প্রাধান্য পাবে। **Channel ৩-এর "Sandbox-এর `bash` দিয়ে Token/Header সহ GitHub-এ Push" অংশ নিষিদ্ধ** (১৩.৬ #৮) — Token কখনো Arena Sandbox-এ/মডেলের Prompt-এ যাবে না।

| # | V3 Draft-এর অনুমান | R1 মূল্যায়ন | অবস্থা | বিকল্প/সংশোধন |
|---|---|---|---|---|
| 1 | Network Stream থেকে Tool Call-এর **সম্পূর্ণ** `{path, content}` পাওয়া যায় | Wire-Format অজানা [VF: Repo-তে Parser নেই]। Tool Call Argument Streaming-এ আংশিক Delta হিসেবে আসতে পারে; Content Truncate/Redact হতে পারে | **[UA][PoF-S1,S2,S9]** | Tool Call-কে "Intent Evidence" ধরা; Content সম্পূর্ণ ও Hash-মিলহলে তবেই Ingest |
| 2 | Stream-এর Tool Result = প্রকৃত Sandbox File State | **ভুল অনুমান হতে পারে।** Tool Call সফল/ব্যর্থ হয়েছে কি না, Edit Apply হয়েছে কি না, পরবর্তী `bash`-এ ফাইল বদলেছে কি না — Stream-এর "Call" থেকে জানা যায় না | **[UA][PoF-S2,S4,S5]** | Stream = Intent; **State = Sandbox-attested Hash Manifest (Tier C)** |
| 3 | `edit_file{context, replacement}` Local-এ Fuzzy Patch করে নিলেই চলে | Arena-র Tool-এর Matching Semantics অজানা; Fuzzy Match ভিন্ন জায়গায় Apply হতে পারে → **নীরব Corruption** | **[UA][PoF-S2]** | Local Patch Candidate মাত্র; Result Hash == Sandbox Hash না হলে `UNVERIFIED`; কখনো Fuzzy ফল Commit নয় |
| 4 | CodeMirror DOM Observer সব ফাইলের নির্ভরযোগ্য উৎস | CodeMirror 6 শুধু **Viewport-এর দৃশ্যমান লাইন** DOM-এ রাখে; অ-খোলা ফাইলের Content DOM-এ নেই; Selector Repo-তে নেই [VF] | **[UA — CM6 Viewport-Rendering সাধারণ জ্ঞান; R1-এ Official Reference ফেচ হয়নি][PoF-S6]** | DOM = **Secondary/Hint**; একমাত্র উৎস নয়; Partial হলে `PARTIAL` চিহ্ন |
| 5 | Model-Generated Snapshot Manifest নিরাপদ | **নিরাপদ নয়।** মডেল Hallucinate/বাদ দিতে পারে; Prompt-Injection-এ বিকৃত হতে পারে | **Rejected as Trust Source** | মডেলের Prose-Manifest **উপেক্ষিত**; কেবল Tool-Result-এ আসা Deterministic-Template-Command Output গ্রহণযোগ্য |
| 6 | Arbitrary `bash` Mutation শনাক্তের নির্ভরযোগ্য উপায় | Stream-এ Command টেক্সট দেখা যায় (সম্ভবত), কিন্তু তার Side-effect (`npm install`, build output, `sed -i`, script) পূর্বানুমান করা যায় না | **[KL]**: Event থেকে নির্ভরযোগ্য Detection **অসম্ভব** | প্রতিটি `bash`-সমৃদ্ধ Turn-এর শেষে Tier C Manifest Diff; Event-ভিত্তিক Detection ছাড়াই Snapshot-ভিত্তিক Detection |
| 7 | Local ও Cloud একই ফাইল বদলালে সংঘর্ষ | V3 Draft-এ অনির্ধারিত | **Gap** | ৬.৭ Three-Way Conflict |
| 8 | আংশিক Content শনাক্ত ও Recovery | অনির্ধারিত | **Gap** | `contentComplete` ফ্ল্যাগ + Size/Hash মিল; ৬.৫ Quarantine |
| 9 | Hydration Bundle মডেল Sandbox-এ হুবহু বসাবে | **LLM বাইট-নির্ভুল Transcriber নয়**; Truncation, Whitespace/Encoding পরিবর্তন, Token Cost; Composer দৈর্ঘ্য-সীমা অজানা | **[UA][PoF-S11,S12]** | Hydration = Request + Hash-Verify + Selective Retry (৬.৮) |

### ৬.৪ সংশোধিত Sync Architecture — Tiered Capture + Hash-Verified Ingest [PD / Conditional]

**নীতি:** **Observation (কী ঘটেছে বলে মনে হয়) ≠ Verification (কী আছে)।** Android Storage-এর Working Tree কেবল **Verified** Content দিয়ে আপডেট হবে।

| Tier | উৎস | কী দেয় | বিশ্বাসযোগ্যতা | Android Storage আপডেট করতে পারে? |
|---|---|---|---|---|
| **A — Stream Observer** (`ap-stream-hook.js`, Experimental) | `/nextjs-api/stream/*` Response-এর Tool-Event (যদি থাকে) | Intent: কোন Tool, কোন Path, (সম্ভবত) Content | নিম্ন-মধ্যম (Intent) | **না** (সরাসরি নয়) — `CANDIDATE` তৈরি করে |
| **B — DOM Observer** (`ap-sandbox-observer.js`, Experimental) | CodeMirror/File-tree/Code-block DOM | দৃশ্যমান Content (Viewport-সীমিত) | নিম্ন (Partial সম্ভব) | **না** — `CANDIDATE`/`HINT`; সম্পূর্ণ হলে Tier C দিয়ে Verify |
| **C — Sandbox-attested Verification** (Official Sandbox-এর নিজস্ব Tool দিয়ে) | ArenaPilot ব্যবহারকারীর অনুমতিতে **একটি নির্দিষ্ট Template Command** (যেমন `find . -type f ! -path './node_modules/*' ! -path './.git/*' -print0 \| sort -z \| xargs -0 sha256sum`) Sandbox-এ চালানোর অনুরোধ করে; Output পড়ে **Tool Result Event/DOM** থেকে | Sandbox-এর প্রকৃত ফাইল-তালিকা ও SHA-256 | **মধ্যম-উচ্চ**: Tool Result Arena-র Tool সিস্টেম থেকে আসে, মডেলের Prose নয় | **হ্যাঁ — একমাত্র পথ**, Content-ও এই পথে/ Tier A/B Content-এর সাথে Hash মিললে |
| **D — User-Driven Import/Export** | Arena-র নিজস্ব Download/Export UI (যদি থাকে [UA]) বা Share/Copy | ব্যবহারকারী-হাতে ফাইল/Zip | ব্যবহারকারী-অনুমোদিত | হ্যাঁ — SAF/Picker-এর মাধ্যমে `USER_IMPORT` |

- **Tier C-এর শর্ত:** (ক) ArenaPilot Template Command-এর **হুবহু স্ট্রিং** Composer-এ বসায় (Visible, ব্যবহারকারী দেখতে পায়, Opt-in); (খ) Tool Result-এ **একই Command স্ট্রিং** দেখা না গেলে Output বাতিল; (গ) মডেল যদি Command না চালায়/বদলে ফেলে ⇒ `UNVERIFIED`; (ঘ) Output Truncate হলে (`…[truncated]`) শনাক্ত করে `PARTIAL`; (ঙ) Content Pull করতে হলে সীমিত আকারের `base64` Chunk (`≤ N KB`, N = PoF-S7-এ নির্ধারিত) Command, প্রতি Chunk-এ Sequence + Chunk-SHA-256, Reassemble ও পূর্ণ-ফাইল Hash যাচাই।
- Tier C Arena-র **Tool Result দৃশ্যতা** (Stream বা DOM-এ পড়া যায় কি না) এবং **Tool Result-এর আকার-সীমা** [UA] ওপর নির্ভরশীল ⇒ PoF-S5, S7।
- **Sandbox-এ কোনো Binary/Agent ইনস্টল নয়; কোনো দ্বিতীয় Environment নয়।** শুধু Official Sandbox-এরই `bash` দিয়ে Read-only Verification Command।

### ৬.৫ Ingest Pipeline, Sync Metadata ও Integrity [PD]

**State Machine (প্রতিটি `sync_event`):**
```
OBSERVED ─► CANDIDATE ─► VERIFIED ─► COMMITTED            (সুখী পথ)
   │            │            │
   │            ├──► PARTIAL (Content অসম্পূর্ণ) ─► (Tier C Pull) ─► CANDIDATE | QUARANTINED
   │            ├──► UNVERIFIED (Hash মেলেনি/Tier C নেই) ─► ব্যবহারকারীকে Verify/Export অনুরোধ
   │            ├──► CONFLICT (৬.৭)
   │            └──► REJECTED (Path-Scope/Schema/Size/Policy ব্যর্থ)
   └──► DUPLICATE (একই Idempotency Key)  ⇒ no-op
```

**প্রতিটি ফাইল-Sync-এর বাধ্যতামূলক Metadata (`sync_events` ও `file_versions`, ১২.৩):**

| Field | বিবরণ |
|---|---|
| `syncId`, `projectId`, `conversationId`, `turnId` | সংযোগ ও Scope (সবগুলো FK) |
| `idempotencyKey` | `conversationId:turnIndex:toolCallIndex` বা `…:tierC:<runId>` — Duplicate Stream/Reload-এ একই Event দ্বিতীয়বার Apply হয় না |
| `sourceTier` | `A_STREAM` · `B_DOM` · `C_ATTESTED` · `D_USER_IMPORT` · `LOCAL_USER_EDIT` |
| `operation` | `CREATE` · `EDIT` · `DELETE` · `RENAME` · `BASH_MUTATION` (Snapshot-Diff থেকে অনুমিত) · `BULK_IMPORT` |
| `path` | **Normalized** Relative Path (NFC, `/`, `..`/Absolute/`\0`/Reserved-name প্রত্যাখ্যাত; Case-collision শনাক্ত) |
| `baseSha256`, `newSha256` | বেস (শেষ Verified) ও নতুন Content-এর SHA-256 (Native-এ **Received Bytes থেকে গণনা**; Source-claimed Hash নয়) |
| `attestedSha256` | Tier C থেকে Sandbox-এর বলা Hash; মিল ⇒ Integrity Check পাস |
| `sizeBytes`, `isBinary`, `mime`, `encoding` | Binary/Text, Charset (UTF-8 কঠোর; অবৈধ UTF-8 হলে Binary হিসেবে) |
| `contentComplete` | bool — Size/Chunk-Seq/Hash দিয়ে নির্ণীত; `false` হলে Working Tree আপডেট নিষিদ্ধ |
| `version` | প্রতি `(projectId,path)` Monotonic পূর্ণসংখ্যা — প্রতিটি Verified Content নতুন Version (Overwrite নয়) |
| `status`, `statusReason` | উপরের State Machine |
| `evidenceJson` | কোন Event/DOM/Command Output থেকে — Debug ও Audit |
| `createdAt`, `verifiedAt`, `committedAt` | সময় |

**Integrity Rules:**
1. **Verified ছাড়া Working Tree/Version আপডেট নয়।** `CANDIDATE` কেবল `staging/` ও DB-তে।
2. `EDIT`: Base (Verified) + Patch = Candidate; `sha256(Candidate) == attestedSha256` বাধ্যতামূলক। অন্যথায় `UNVERIFIED`।
3. `DELETE`: Tier C Manifest-এ Path অনুপস্থিতি দেখেই Verified; শুধু Stream-এর `delete_file` Intent-এ Local Delete নয় — **Soft-delete (Tombstone Version)**; Content মুছে যায় না (Rollback সম্ভব)।
4. **Binary/Archive/বড় ফাইল:** Hash ও Metadata সবসময় (Tier C)। Content শুধু Size ≤ Policy-Limit (প্রাথমিক প্রস্তাব ২ MB/ফাইল, Total ২০ MB/Turn — PoF-S7 এ সংশোধনীয়) এবং Chunked-base64 পূর্ণ Hash মিললে। অন্যথায় Metadata-only (`CONTENT_NOT_CAPTURED`) এবং UI-তে স্পষ্ট চিহ্ন — "সংরক্ষিত" বলা যাবে না।
5. **কখনো "Saved/Synced" ঘোষণা নয়** যদি ফাইল `COMMITTED` না হয়। UI-তে `✓ Verified N · ⚠ Unverified M · ⛔ Not captured K`।

### ৬.৬ Atomic Commit ও Crash Safety [PD]
1. Verified Content `workspaces/<projectId>/.staging/<syncId>/` এ লিখে `fsync`।
2. **একটি Room Transaction:** `file_versions` Insert → `project_files` (Head Pointer) Update → `sync_events.status=COMMITTED` → FTS Update (Trigger/Explicit, ১২.৩)।
3. Staging→Tree `Files.move(..., ATOMIC_MOVE)` (একই Filesystem)। `COMMITTED` চিহ্ন Move **সম্পন্ন হওয়ার পর**; Startup-এ `SyncRecovery` Journal রিপ্লে করে অর্ধেক-অবস্থা ঠিক করে ও অনাথ Staging পরিষ্কার করে।
4. Content-Addressed Blob Store (`blobs/<sha256[0:2]>/<sha256>`) — একই Content-এর একাধিক Version Dedup; Version History এভাবেই সংরক্ষিত; GC শুধু Unreferenced Blob-এর ওপর, ৭ দিন Grace।
5. পুনরাবৃত্ত পরিবর্তন (Test #8): প্রতিটি Verified Version `file_versions`-এ; Retention: প্রতি ফাইলে শেষ N (ডিফল্ট ৫০) + প্রতি Turn-Snapshot-এ রেফারেন্সকৃত সব।

### ৬.৭ Conflict Resolution (Local বনাম Official Sandbox/Cloud) [PD]
- **Three-Way:** Base = শেষ `COMMITTED` Version; Local = Android Working Tree (ব্যবহারকারী বা SAF Mirror থেকে পরিবর্তিত); Remote = Tier C Attested।
- Local ও Remote **দুটোই** Base থেকে ভিন্ন ও পরস্পর ভিন্ন ⇒ `CONFLICT`। **Auto-Overwrite নিষিদ্ধ।** দুটি Version-ই `file_versions`-এ সংরক্ষিত; UI: Keep Local / Keep Sandbox / Text-Merge (diff3, শুধু UTF-8 Text) / Save Both (`name.conflict-<ts>`)।
- Binary ⇒ কেবল Keep-one বা Save-both।
- Conflict থাকা অবস্থায় Hydration (Android→Sandbox) সেই ফাইলের জন্য নিষিদ্ধ।
- সংঘর্ষের কারণ ব্যবহারকারীকে বোধগম্য ভাষায় (বাংলা/English) দেখানো।

### ৬.৮ Hydration Protocol পুনর্নকশা (Android Storage → Official Sandbox) [PD / PoF-S11, S12]
1. **Manifest-First:** প্রথমে `(path, size, sha256)` তালিকা + `PLAN.md`/`PROGRESS.md` + Active Task। ছোট Text ফাইল (Policy ≤ প্রাথমিক ১০০ KB Total) Content সহ।
2. মডেলকে Official Tool দিয়ে ফাইল বসাতে অনুরোধ; **তারপর বাধ্যতামূলক Tier C Verify**। মিলে গেলে `HYDRATED`; না মিললে শুধু **অমিল ফাইলগুলোর** Selective Retry (সর্বোচ্চ ২ বার); শেষে Report।
3. Binary/বড় ফাইল Composer-এর মাধ্যমে নয় [KL]। বিকল্প: (ক) ব্যবহারকারী Arena-র নিজস্ব Upload (ছবি-মাত্র [VF]) — ব্যবহারযোগ্য নয়, (খ) Sandbox-এর নিজস্ব ইন্টারনেট থেকে Public Source (যদি Sandbox-এ নেট থাকে [UA]) — **Credential ছাড়া**, (গ) অনুপলব্ধ হলে "Hydration Partial" ঘোষণা।
4. `<AP:LOCAL_FILE_READ>` রূপান্তরিত: `APH/1 local_file_read{path,range}` — Broker-মধ্যস্থ, Read-only, Project-scoped, Size/Range-capped, প্রতিটি Call Audit-এ; ব্যবহারকারী Policy: `ask_each_time` (ডিফল্ট) / `allow_for_project`।
5. **কখনো দাবি নয়** যে Sandbox State "Restored" — শুধু "N/M ফাইল Hash-verified"।

### ৬.৯ Arena বনাম ArenaPilot — দায়িত্ব বিভাজন (পুনর্নির্মাণ এড়ানো) [PD]

| দায়িত্ব | Arena (Official) | ArenaPilot |
|---|---|---|
| Code Execution, Dev Server, Preview, Terminal | ✅ একমাত্র | ❌ কখনো নয় |
| Chat/Code Session ইতিহাস ও পুনরায় খোলা (`/c/{id}`) | ✅ **[RF]** ("restorable and persistent across visits") — পরিধি **[UA][PoF-S10,S11]** | কেবল Metadata/Turn Ledger (Conversation→Project Binding); Arena-র ইতিহাস পুনর্নির্মাণ নয় |
| Sandbox-এর অভ্যন্তরীণ Snapshot/R2 | Arena-র নিজস্ব (দাবি Secondary **[UA]**) — ArenaPilot ভরসা/অ্যাক্সেস করে না | — |
| ব্যবহারকারীর **দীর্ঘমেয়াদি, নিজস্ব, Verified কপি** | ❌ ঘোষিত নয় | ✅ Working Tree + Versions + SAF Mirror + Backup |
| Version History, Hash, Integrity, Conflict | ❌ | ✅ |
| GitHub Branch/Commit/PR | ❌ | ✅ (Native, ৭.৫) |
| Export/Recovery যখন Capture অসম্ভব | — | ✅ Tier D + Pull-Export (দ্বিতীয় Sandbox ছাড়া) |

### ৬.১০ বিকল্প Recovery ও Export Mechanism (Capture অসম্পূর্ণ হলেও) — দ্বিতীয় Sandbox ছাড়া [PD]
1. **Pull-Export Checkpoint:** প্রতি Turn/Milestone-এ ব্যবহারকারীর **ম্যানুয়াল বা Opt-in স্বয়ংক্রিয়** "Verify & Capture" (Tier C)।
2. **Arena-র নিজস্ব Export/Download UI** (থাকলে [UA]) → ব্যবহারকারী ফাইল/Zip Android-এ নামায় → ArenaPilot `ACTION_OPEN_DOCUMENT` দিয়ে Import (`USER_IMPORT`, Zip-slip/Zip-bomb গার্ডসহ)।
3. **Code-block Save:** Chat-এ দেখা পূর্ণ কোড ব্লক Share/Copy → Project-এ "Save as file" (ব্যবহারকারী পাথ দেয়; `Tier B-lite`, `UNVERIFIED` লেবেল)।
4. **Arena Session পুনরায় খোলা** (`/c/{id}`) — Arena-র নিজস্ব Persistence ব্যবহার (পরিধি PoF-S10)।
5. কোনো উপায়েই ফাইল Verified না হলে UI স্পষ্ট বলবে "এই ফাইল ArenaPilot-এ **সংরক্ষিত নয়**"।

#### ৬.১০.১ PoF ফলাফল অনুযায়ী Go/No-Go সিদ্ধান্ত-ম্যাট্রিক্স [PD]

| PoF ফল | সিদ্ধান্ত | Product দাবি |
|---|---|---|
| S1,S2,S3,S4,S5,S6,S9 পাস; Tier A+C কার্যকর | **GO-FULL** | "প্রতি Turn-এ Verified Auto-Sync" |
| Tier A অসম্পূর্ণ, Tier C কার্যকর | **GO-CHECKPOINT** | "Turn-শেষে Verified Checkpoint Sync" (Real-time নয়) |
| Tier C-ও Tool Result পড়তে পারে না | **GO-ASSISTED** | "Export/Import-ভিত্তিক সহায়ক Backup"; স্বয়ংক্রিয় Sync দাবি নয় |
| কোনোটিই নয় | **NO-GO (Sync)** | Code Mode-এ কেবল Chat-Transcript ও ব্যবহারকারী-সংরক্ষিত Code Block; Roadmap Phase 4 বাতিল/পুনর্লিখিত |

---

## 7. GitHub Agent ও Repository Workflow Specification

> **R1:** §৭.১–৭.৪-এর API-ক্রম বহাল, কিন্তু সীমাবদ্ধতা ও নিরাপত্তা-নীতি §৭.৫-এ সংযোজিত; Classic Token ডিফল্টে প্রত্যাখ্যাত; "`?recursive=1` একবারেই সব" — `truncated` সীমা আছে [VF]।

Code Mode-এ বাস্তব সফটওয়্যার ডেভেলপমেন্টের জন্য একটি পূর্ণাঙ্গ নেটিভ **GitHub Agent Engine (`GitHubAgentEngine.kt`)** তৈরি করা হবে।

### ৭.১ সংযোগ ও প্রমাণীকরণ (Authentication & Token Security)
1. **Fine-Grained PAT ও OAuth Device Flow সমর্থন:**
   - ব্যবহারকারী Settings → **GitHub & Repositories** অথবা Code Mode-এর **GitHub Sheet** থেকে নিজের GitHub Personal Access Token (Fine-grained PAT বা Classic Token) সংযুক্ত করতে পারবেন।
   - টোকেনটি কখনোই প্লেইনটেক্সটে `SharedPreferences` বা JS স্টোরেজে রাখা হবে না; এটি শুধুমাত্র Android Keystore-ভিত্তিক `EncryptedCredentialVault`-এ সংরক্ষিত থাকবে এবং **কখনোই WebView-এর JS বা AI মডেলের প্রম্পটে পাঠানো হবে না!**
2. **Token Verification & Scope Check:**
   - টোকেন সেভ করার সময় `GET https://api.github.com/user` কল করে ব্যবহারকারীর ইউজারনেম, অ্যাভাটার, রেট-লিমিট (`X-RateLimit-Remaining`) এবং পারমিশন যাচাই করে সাথে সাথে UI-তে দেখানো হবে।

### ৭.২ Repository, Branch, Commit ও File Tree বিশ্লেষণ
1. **Repository & Branch Browser:**
   - ব্যবহারকারীর সকল রিপোজিটরি (`GET /user/repos?sort=updated&per_page=100`) বা যেকোনো পাবলিক/প্রাইভেট `owner/repo` সার্চ করে প্রজেক্টের সাথে যুক্ত (Link) করা যাবে।
   - ব্রাঞ্চ তালিকা (`GET /repos/{owner}/{repo}/branches`) দেখা, ব্রাঞ্চ পরিবর্তন করা এবং নতুন ফিচার ব্রাঞ্চ (`POST /repos/{owner}/{repo}/git/refs`) তৈরি করা যাবে।
2. **Fast Recursive Tree Indexing (৬৪ MB ZIP ডাউনলোড ছাড়াই):**
   - `GET /repos/{owner}/{repo}/git/trees/{branch_sha}?recursive=1` কল করে কয়েক সেকেন্ডের মধ্যে পুরো রিপোজিটরির হাজার হাজার ফাইলের পাথ, আকার (`size`), ও Blob SHA এনে Room ডাটাবেসের `github_tree_entries` টেবিলে ইনডেক্স করা হবে।
   - শুধুমাত্র যে ফাইলগুলো মডেল বা ব্যবহারকারী দেখতে চায় বা পরিবর্তন করে, সেগুলো `GET /repos/{owner}/{repo}/git/blobs/{file_sha}` দিয়ে ডাউনলোড করে স্থানীয় ওয়ার্কস্পেসে ক্যাশ করা হবে।

### ৭.৩ মাল্টি-ফাইল ও বড় Codebase পরিচালনা (Large Codebase Strategy)
বড় রিপোজিটরিতে (যেমন ১০,০০০+ লাইনের প্রজেক্ট) সব ফাইল প্রম্পটে দেওয়া অসম্ভব। তাই `GitHubAgentEngine` ও `ProjectEngine` যৌথভাবে **3-Stage Smart Context Discovery** ব্যবহার করবে:
1. **Stage 1 — Repository Map:** প্রম্পটে সর্বদা রিপোজিটরির ডিরেক্টরি কাঠামো ও প্রধান কনফিগ ফাইলগুলোর তালিকা দেওয়া থাকে।
2. **Stage 2 — Local & Remote Tool Calls:** মডেল যখন কোনো ফাইল খুঁজতে বা পড়তে চায়, সে অফিসিয়াল স্যান্ডবক্সের টুল অথবা ArenaPilot-এর নেটিভ রিপো টুল ব্যবহার করে:
   - `<AP:GITHUB_TREE path="android/app/src"/>`
   - `<AP:GITHUB_SEARCH query="handleFetchGithubCommits"/>`
   - `<AP:GITHUB_READ path="android/app/src/main/java/com/arenadeck/app/WebViewBridge.kt" startLine="1600" endLine="1750"/>`
3. **Stage 3 — Official Sandbox Staging:** নির্বাচিত ফাইলগুলো অফিসিয়াল স্যান্ডবক্সে হাইড্রেট করা হয় যাতে মডেল সেখানে কোড এডিট, বিল্ড ও টেস্ট চালাতে পারে।

### ৭.৪ Atomic Commit, Push, Pull Request ও CI Monitoring Workflow
যখন মডেল অফিসিয়াল স্যান্ডবক্সে কোড পরিবর্তন ও টেস্ট সম্পন্ন করে এবং ফাইলগুলো Android-এর ওয়ার্কস্পেসে সিঙ্ক হয়:
1. **Diff Review & History:**
   - Android-এর **Diff Review Sheet**-এ প্রতিটি পরিবর্তিত ফাইলের (`Added`, `Modified`, `Deleted`) লাইন-বাই-লাইন ইউনিফাইড ডিফ (Unified Diff) দেখানো হবে।
   - প্রতিটি টার্নের পরিবর্তন স্থানীয়ভাবে `sandbox_snapshots` টেবিলে সংরক্ষিত থাকে, তাই যেকোনো সময় পূর্ববর্তী অবস্থায় **Rollback / Undo** করা যাবে।
2. **Atomic Multi-File Commit & Push (Git Data API):**
   - ব্যবহারকারী **"Commit & Push"** অনুমোদন করলে (অথবা অনুমোদিত অটো-পুশ মোডে) `GitHubAgentEngine` নিচের ধাপগুলো সম্পন্ন করে:
     1. প্রতিটি পরিবর্তিত ফাইলের জন্য `POST /repos/{owner}/{repo}/git/blobs` কল করে নতুন Blob SHA তৈরি করে।
     2. বেস ব্রাঞ্চের সর্বশেষ ট্রি (`base_tree`) উল্লেখ করে `POST /repos/{owner}/{repo}/git/trees` কল করে নতুন Tree SHA তৈরি করে (মুছে ফেলা ফাইলের ক্ষেত্রে `sha: null`)।
     3. প্যারেন্ট কমিট SHA ও কমিট মেসেজ দিয়ে `POST /repos/{owner}/{repo}/git/commits` কল করে নতুন Commit SHA তৈরি করে।
     4. `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` কল করে ব্রাঞ্চ পয়েন্টার আপডেট করে।
3. **Pull Request & CI Loop:**
   - `POST /repos/{owner}/{repo}/pulls` দিয়ে সরাসরি অ্যাপ থেকে Pull Request তৈরি করা বা বিদ্যমান PR দেখা।
   - `GET /repos/{owner}/{repo}/actions/runs?branch={branch}&per_page=5` এবং ব্যর্থ জবের লগ পোল করে CI ফলাফল দেখা এবং CI ফেল করলে সেই এরর লগ সরাসরি Code Mode এজেন্টকে দিয়ে ফিক্স করানো!

### ৭.৫ Revision R1 — GitHub Agent শক্তিশালীকরণ (সীমাবদ্ধতা, Race, নিরাপদ Feature-Branch নীতি)

#### ৭.৫.১ বাস্তবে সম্পন্ন Read-only PoF (২০২৬-১১-১৮) [VF] — **PoF-G1/G2 আংশিক সম্পন্ন**
এই Repository-র ওপর, Fine-grained PAT দিয়ে, **কোনো Write ছাড়া**:

| পরীক্ষা | ফলাফল |
|---|---|
| `GET /git/trees/main?recursive=1` | HTTP 200; Response Keys `sha,url,tree,truncated`; **২৭৫ Entry, ৮৮,১২১ বাইট, `truncated=false`** |
| বৃহত্তম Blob (`content.js`) `GET /git/blobs/{sha}` | HTTP 200; `encoding=base64`; `size=3,355,954`; Decode করা Byte-সংখ্যা == `size`; **Git-Blob-SHA-1 (`blob <len>\0…`) মিলেছে** — **কিন্তু এটি SHA-1; ArenaPilot-এর SHA-256 Integrity-র বিকল্প নয়** (দুটি আলাদা Hash রাখতে হবে) |
| Rate-limit Header | `x-ratelimit-limit: 5000`, `x-ratelimit-resource: core`; Remaining হ্রাস দৃশ্যমান |
| Permission/Expiry Header | `x-accepted-github-permissions: contents=read` (Trees), `metadata=read` (Repo); `github-authentication-token-expiration` উপস্থিত |
| **যা পরীক্ষা হয়নি** | `truncated=true` পথ (বড় Repo লাগে), Write-পথ (Blob/Tree/Commit/Ref), Secondary Rate Limit, Actions Dispatch/Artifact, Branch Race — সবই **[PoF Pending]** |

#### ৭.৫.২ সীমাবদ্ধতা ও সিদ্ধান্ত

| বিষয় | তথ্য | সিদ্ধান্ত [PD] |
|---|---|---|
| **Recursive Tree সীমা** | ১০০,০০০ Entry / ৭ MB [VF Official]; `truncated:true` | `truncated=false` হলে এক কল। `true` হলে **Subtree Recovery:** Root Tree Non-recursive আনা → প্রতিটি `type=tree` Entry-র জন্য Bounded-Parallel (≤ ৪) Non-recursive Fetch; যে Subtree নিজেই `truncated` হলে আরও নামা; Ignore-তালিকা (`node_modules`, `vendor`, `dist`, `build`, `.git`) আগেই বাদ। ফলাফল `github_tree_entries`-এ + `treeComplete` ফ্ল্যাগ; অসম্পূর্ণ হলে UI-তে সতর্কতা, "সব ফাইল দেখা হয়েছে" দাবি নয় |
| **Blob Encoding/আকার** | ≤ ১০০ MB; Default JSON-এ base64 (≈ +৩৩% ওভারহেড) [VF] | `Accept: application/vnd.github.raw+json` দিয়ে Raw Stream → Disk (Memory-তে নয়); Size > ২ MB হলে Model-Context-এ পাঠানো নয়, Metadata-only; Size/SHA(Git) যাচাই |
| **Binary ফাইল** | Blob ও Tree-তে বাইনারি সমর্থিত | Binary Model-Context-এ নয়; Commit-এ Blob `encoding: base64` দিয়ে তৈরি; Git LFS Pointer শনাক্ত করে "LFS ফাইল—Content নেই" দেখানো (LFS-এর Write ArenaPilot সমর্থন করে না [KL]) |
| **Primary Rate Limit** | PAT: ৫,০০০/ঘণ্টা [VF Header] | প্রতিটি Response-এ `x-ratelimit-*` ট্র্যাক; Remaining < ১০% ⇒ Background Sync বিরতি; **ETag/`If-None-Match` Conditional Request** (Conditional Request-এ 304 Primary Limit-এ গণ্য না-ও হতে পারে — **[UA]**: R1-এ Official পাঠ হয়নি; PoF-G6-এ নিশ্চিত) |
| **Secondary Rate Limit** | ≤১০০ Concurrent, ≈৯০০ Point/মিনিট, ≈৮০ Content-create/মিনিট, বিনা নোটিশে পরিবর্তনযোগ্য [RF Secondary] | **Write-পথ Serial** (১টি Blob-Upload Queue, সর্বোচ্চ ২ Concurrent); `403/429` + `retry-after` সম্মান; `retry-after` না থাকলে ≥ ৬০ সেকেন্ড; Commit-ব্যাচে Blob সংখ্যা Cap (প্রাথমিক ১০০/Commit) |
| **Branch Race / Concurrent Commit** | অন্য ব্যক্তি/CI/দ্বিতীয় ডিভাইস Head সরাতে পারে | Commit-এর আগে `GET ref` ⇒ `expectedHead` সংরক্ষণ; Commit-এর Parent = `expectedHead`; শেষে `PATCH ref` **`force:false`**। `422` (Non-fast-forward) ⇒ **থামো**, Remote Diff দেখাও, ব্যবহারকারী বেছে নেবেন: Rebase-prompt / নতুন Branch-এ Push / বাতিল। **স্বয়ংক্রিয় Merge/Rebase নয়** |
| **Force Push / Non-FF** | — | **নিষিদ্ধ** (Broker-এ `force:true` ব্লক); `refs/heads/<default>` লেখা নিষিদ্ধ |
| **Atomic Multi-file Commit-ব্যর্থতা** | Blob/Tree/Commit Object Ref-এর আগে তৈরি; কেবল `PATCH ref` Branch সরায় | Ref-Update-এর আগের ব্যর্থতা ⇒ কোনো Repository State বদলায়নি (অনাথ Object নিরীহ; GitHub GC করে)। `commit_attempts` Journal-এ `blobShas/treeSha/commitSha` সংরক্ষিত ⇒ Retry-তে পুনঃব্যবহার (Idempotent)। Ref-Update সফল কিন্তু Response হারালে ⇒ `GET ref` দিয়ে Head == `commitSha` যাচাই, নতুবা Retry |
| **Deletion/Rename** | Tree Entry `sha:null` দিয়ে Delete [VF-ধারণা, Write PoF Pending] | Rename = Delete+Add; `mode`(100644/100755/120000) সংরক্ষণ — Symlink/Executable-bit হারানো রোধ |
| **Workflow ফাইল** | `.github/workflows/*` পরিবর্তনে Token-এর `workflows` Permission লাগে — **[UA]** (R1-এ Official Doc ফেচ হয়নি; PoF-G3-এ নিশ্চিত) | ডিফল্টে Workflow-ফাইল Agent-এ **Read-only**; লেখা আলাদা Consent |

#### ৭.৫.৩ Large Repository Context Discovery (কখনো পুরো Codebase নয়) [PD]
1. **Repository Map (Stage 1):** `github_tree_entries` থেকে Directory-Collapsed Tree (গভীরতা-সীমিত), ভাষা-পরিসংখ্যান, Manifest/Config (`package.json`, `build.gradle*`, `README`, `CODEOWNERS`) — বাজেট ≤ প্রাথমিক ২–৪K Token।
2. **On-Demand Retrieval (Stage 2):** `github_read(path, startLine, endLine)`, `github_tree(path)`, `github_grep(pattern, glob)` — শেষেরটি **Fetch করা Blob Cache**-এর ওপর Local; Cache-এ না থাকা অংশের জন্য GitHub Code Search API ব্যবহার করা যেতে পারে, কিন্তু Search API-র আলাদা ও সম্ভবত নিম্নতর Rate Limit — **[UA]**, PoF-G6 তাই Fallback মাত্র।
3. **Smart Ranking:** Task-Keyword/Symbol, Recent-commit Touch, Import-Graph Neighbors (Fetch-কৃত ফাইলের Regex-ভিত্তিক Import পার্স; AST নয়—Language-Specific, [PD]), Path-Prior (`src/` > `docs/`); Generated/Vendored/Lock/Minified (যেমন এই Repo-র ৩.৩ MB `content.js`) ডিফল্টে বাদ ও চিহ্নিত।
4. **Budgeting:** প্রতি Turn-এ ফাইল-সংখ্যা ও Token Cap (`ContextBudgeter`, ৫.৪.৬); বড় ফাইলে Range-read।
5. **Staleness:** Cache Key = Blob SHA; Branch Head বদলালে Tree পুনঃ-Validate (ETag)।

#### ৭.৫.৪ Authentication — Fine-grained PAT, OAuth ও Device Flow
**Primary (V3.0): Fine-grained PAT** — Single Owner, নির্বাচিত Repository, মেয়াদসীমা। Token সংরক্ষণ `KeystoreCredentialVault`-এ।

| Capability | PAT Permission (Fine-grained) |
|---|---|
| Repo Browse/Tree/Blob | Metadata: read (স্বয়ংক্রিয়), **Contents: read** |
| Branch তৈরি, Commit | **Contents: write** |
| Pull Request তৈরি/পড়া | **Pull requests: write** |
| Actions Run/Log/Artifact পড়া | **Actions: read** |
| Workflow Dispatch | **Actions: write** (এবং Workflow-তে `workflow_dispatch` ট্রিগার) |
| Workflow ফাইল পরিবর্তন | **Workflows: write** — ডিফল্টে চাওয়া হবে না |

- **Least-privilege Onboarding:** প্রথমে Read-only Token প্রস্তাবিত; Write-Capability চালু করতে ব্যবহারকারী আলাদা (বা আপগ্রেডেড) Token দেন। Classic Token (`repo` Scope = সব Private Repo-তে Write) **ডিফল্টে প্রত্যাখ্যাত**; "Advanced" এ সতর্কতাসহ অনুমোদনযোগ্য। Token সংরক্ষণকালে `x-accepted-github-permissions`/Expiry Header ও `GET /user` পড়ে Scope-সারাংশ দেখানো; মেয়াদ ≤ ৭ দিন বাকি থাকলে সতর্কতা [VF: Expiry Header উপস্থিত]।
- **OAuth Device Flow / GitHub App [UA — সাধারণ জ্ঞান-ভিত্তিক; R1-এ Official Doc ফেচ হয়নি, PoF-G7-এ যাচাই]:** সুবিধা — Token ম্যানুয়াল পেস্ট নয়; GitHub App User-token-এ Fine-grained Permission ও মেয়াদোত্তীর্ণ/Refreshable Token সম্ভব। সীমাবদ্ধতা — ArenaPilot-এর জন্য একটি **Registered App (client_id)** ও Maintainer-পরিচালিত Registry লাগে; OAuth-App Scope মোটা (`repo`); GitHub-App-এ প্রতিটি Repository-তে ব্যবহারকারীকে Install করতে হয়; Org-অনুমোদন জটিলতা; Open-source APK-তে `client_secret` রাখা যায় না (Device Flow-তে লাগে না)। **সিদ্ধান্ত:** V3.0-এ PAT; Device Flow `Proposed (post-3.0)`, PoF-G7 পাস ও App Registration-এর পর।

#### ৭.৫.৫ Feature-Branch-Only ও Main-সুরক্ষা নীতি (Policy as Code, Broker-এ প্রয়োগ) [PD]
1. Agent শুধু `arenapilot/<project-slug>/<yyyymmdd>-<slug>` Branch-এ লেখে; Default Branch/Protected Branch/ব্যবহারকারীর অন্য Branch-এ **Write ব্লকড** (Prompt-এ নয়, Broker-Policy-তে)।
2. Branch তৈরি → **Soft-confirm**; Commit/Push → **Diff & Commit Confirmation Sheet** (ফাইল-তালিকা, Unified Diff, Message, Target Branch, Expected Head); PR তৈরি → Confirm; **Merge, Branch Delete, Force Push, Tag/Release — Agent-এর ক্ষমতার বাইরে** (ব্যবহারকারী GitHub-এ নিজে)।
3. "Auto-push" মোড ডিফল্ট **বন্ধ**; চালু করলেও কেবল Agent-Branch-এ, Rate-limited, প্রতি ঘণ্টা সর্বোচ্চ N Commit; প্রতিটি Push Audit-এ।
4. Commit-এ ব্যবহারকারী-অনুমোদিত ফাইল-Set-এর বাইরের Path থাকলে **Reject**; Secret-Scanner (Regex: PAT/AWS/Private-Key প্যাটার্ন) Commit-এর আগে চালিয়ে Hit-এ Block + ব্যবহারকারীকে জানানো।
5. Actions Dispatch ও Artifact Retrieval: Dispatch কেবল ব্যবহারকারী-নির্বাচিত Workflow ও Agent-Branch; Artifact ডাউনলোড Redirect-এ **Authorization Header অন্য হোস্টে ফরোয়ার্ড নয়** [RF; PoF-G5]; Artifact Zip → Zip-slip/bomb গার্ডসহ Quarantine Folder-এ, Execute নয়; লগ ও Artifact Prompt-Injection-এর উৎস হিসেবে **Untrusted** (১৩.৬)।

#### ৭.৫.৬ GitHub PoF তালিকা (Appendix A-তে বিস্তারিত)
`PoF-G1` Tree/Blob Read (✔ আংশিক সম্পন্ন) · `G2` `truncated=true` Subtree Recovery · `G3` Multi-file Commit (Scratch Repo, Write) · `G4` Branch Race/Non-FF · `G5` Actions Dispatch+Artifact · `G6` Secondary Rate Limit/ETag/Search-limit · `G7` Device Flow সম্ভাব্যতা।

---

## 8. Native Persistent Storage ও File Management System

### ৮.১ Unified Storage Directory Hierarchy
অ্যাপের ভেতরে বিচ্ছিন্ন স্টোরেজের পরিবর্তে `context.filesDir`-এর অধীনে একটি সুশৃঙ্খল ও ভবিষ্যৎ-বান্ধব ডিরেক্টরি কাঠামো থাকবে:

```
<context.filesDir>/
 ├── databases/
 │    └── arenapilot_v3.db              # Room SQLite Database (WAL mode + FTS4)
 ├── datastore/
 │    └── ap_settings.preferences_pb    # Jetpack DataStore for fast atomic preferences
 ├── workspaces/                        # All Project & Official Sandbox Workspaces
 │    └── <projectId>/
 │         ├── meta.json                # Project manifest & sync state
 │         ├── tree/                    # Live working tree (mirrors Official Sandbox / Repo)
 │         │    ├── PLAN.md
 │         │    ├── PROGRESS.md
 │         │    └── src/...
 │         ├── snapshots/               # Immutable per-turn snapshots for rollback
 │         │    └── <turnId>/
 │         └── artifacts/               # Generated DOCX, XLSX, PPTX, HTML, ZIPs
 ├── uploads/                           # User-uploaded files & parsed document caches
 │    └── <artifactId>/
 │         ├── original.<ext>           # Original file (or SAF URI reference if external)
 │         ├── extracted_text.md        # Parsed Markdown/tables from PDF/DOCX/XLSX/PPTX
 │         └── pages/                   # Rendered page thumbnails for PDFs
 ├── gallery/                           # Image Mode generated images
 │    └── <YYYY-MM>/
 │         └── <imageId>.png
 └── backups/                           # Full/Project export bundles (.apbackup / .zip)
```

### ৮.২ Custom Android `DocumentsProvider` (`ArenaWorkspaceDocumentsProvider`)
Android-এর নেটিভ স্টোরেজের সাথে সর্বোচ্চ সমন্বয়ের জন্য অ্যাপটি `android.provider.DocumentsProvider` বাস্তবায়ন করবে:
- **কী সুবিধা দেবে:** ব্যবহারকারী ফোনের ডিফল্ট **Files** অ্যাপ বা যেকোনো কোড এডিটর (Acode, Markor, Solid Explorer) খুললেই বাম পাশের মেনুতে **"ArenaPilot Workspaces"** নামে একটি রুট ফোল্ডার দেখতে পাবে!
- **নিরাপত্তা:** এটি শুধুমাত্র `filesDir/workspaces/` এবং `filesDir/gallery/` ডিরেক্টরি প্রকাশ করবে; ডাটাবেস বা কী-স্টোর ফাইল কখনোই প্রকাশ করবে না।

### ৮.৩ SAF Two-Way External Folder Sync (`SafFolderSyncManager`)
ব্যবহারকারী যদি নিজের ফোনের শেয়ার্ড স্টোরেজের কোনো ফোল্ডার (যেমন `Documents/MyProject`) প্রজেক্টের সাথে যুক্ত করতে চান:
- `Intent.ACTION_OPEN_DOCUMENT_TREE` দিয়ে ফোল্ডার নির্বাচন এবং `takePersistableUriPermission` দিয়ে স্থায়ী রিড/রাইট অনুমতি নেওয়া হবে।
- `SafFolderSyncManager` ফাইলগুলোর `(relativePath, size, lastModified, sha256)` তুলনা করে অভ্যন্তরীণ `workspaces/<projectId>/tree/` এবং বাহ্যিক SAF ফোল্ডারের মধ্যে টু-ওয়ে সিঙ্ক (Import / Export / Auto-Sync on Turn Complete) সম্পন্ন করবে।

### ৮.৪ Built-in Native File Manager সক্ষমতা
অ্যাপের ভেতরে একটি নেটিভ **Workspace & File Manager Sheet** থাকবে যার মাধ্যমে ব্যবহারকারী:
- সব প্রজেক্ট ফোল্ডার, স্যান্ডবক্স ফাইল, আপলোড করা ডকুমেন্ট এবং জেনারেটেড ইমেজ ব্রাউজ করতে পারবেন।
- ফাইল ও ফোল্ডার **Create, Import, Export (MediaStore Downloads / SAF), Copy, Move, Rename ও Delete** করতে পারবেন।
- রুম FTS4 ইনডেক্সের মাধ্যমে ফাইলের নাম ও ভেতরের টেক্সট অনুযায়ী **তাৎক্ষণিক ফুল-টেক্সট সার্চ (<50ms)** করতে পারবেন।
- `ZIP` ও `TAR.GZ` ফাইল কম্প্রেস ও এক্সট্র্যাক্ট করতে পারবেন।
- যেকোনো ফাইল সিলেক্ট করে **"Send to Current Chat"** বা **"Add to Project"** করতে পারবেন।

### ৮.৫ Revision R1 — Storage Layer-গুলোর সংজ্ঞা ও দায়িত্ব

> **৮.১ Errata [VF]:** (ক) Room Database `context.filesDir/databases/`-এ থাকে না; Room ডিফল্টে `context.getDatabasePath(name)` অর্থাৎ `/data/data/<pkg>/databases/`-এ থাকে। §৮.১-এর Directory-ট্রি-তে `databases/` `filesDir`-এর ভেতরে দেখানো **ভুল**; এটি Internal Working Storage-এর **ভাই-ডিরেক্টরি**। (খ) `filesDir/backups/` App-private ⇒ **Uninstall/Clear Data-এ মুছবে**; তাই এটি Backup-এর **চূড়ান্ত গন্তব্য নয়** (শুধু Staging)। (গ) `DocumentsProvider` (§৮.২) ও SAF Sync (§৮.৩) **Data Durability-র নিশ্চয়তা নয়**, নিচের ৮.৮ দেখুন।

| Layer | অবস্থান | কী থাকবে | Uninstall | Clear Data | নিয়ন্ত্রণ |
|---|---|---|---|---|---|
| **L1 — Internal Working Storage** | `filesDir`, `getDatabasePath()`, `cacheDir`, `noBackupFilesDir` | Room DB, Content-Addressed Blob Store, Workspace Tree/Staging, DataStore, `KeystoreCredentialVault` ফাইল, Upload/Parse Cache, Gallery | **সব হারায়** [RF Official] | **সব হারায়** [RF] | অ্যাপ |
| **L2 — User-Owned Persistent Storage (SAF Mirror)** | ব্যবহারকারী-নির্বাচিত Tree URI (`Documents/…`) | প্রকল্পের **Plain-file Mirror** (পাঠযোগ্য Tree) + `.arenapilot/manifest.json` (projectUuid, Hash-তালিকা; **কোনো Secret নয়**) | **ফাইল টিকে থাকে** (ব্যবহারকারীর Storage); **URI Grant বাতিল হবে ধরে নিতে হবে** [UA→PoF-D2] — পুনরায় Pick দরকার | ফাইল টিকে থাকে; Grant হারাতে পারে [UA→PoF-D3] | ব্যবহারকারী |
| **L3 — Export/Backup Storage** | ব্যবহারকারী-নির্বাচিত SAF গন্তব্য/Share Target/Cloud-Provider (Drive ইত্যাদি) | Encrypted Portable `.apbackup` (৮.৯) | টিকে থাকে (ব্যবহারকারী-মালিকানাধীন স্থানে থাকলে) | টিকে থাকে | ব্যবহারকারী |

**নীতি:** ব্যবহারকারীর গুরুত্বপূর্ণ কাজের জন্য কমপক্ষে **দুটি স্বাধীন অবস্থান** (L1 + [L2 অথবা L3 অথবা GitHub]) UI-তে "Protection Status" হিসেবে দেখানো হবে (`⚠ Only on this phone` / `✓ Mirrored` / `✓ Backed up <date>` / `✓ On GitHub`)। শুধু L1-এ থাকলে স্পষ্ট সতর্কতা।

### ৮.৬ Failure Scenario ও Recovery Matrix

| পরিস্থিতি | কী ঘটবে | ডিজাইন-প্রতিক্রিয়া [PD] | PoF/Test |
|---|---|---|---|
| **App Uninstall** | L1 পুরো মুছে যায় (Keystore Key-ও); L2/L3 ফাইল টিকে থাকে; Auto Backup নেই (`allowBackup=false` [VF]) | Install-পর First-run "Restore Wizard": L3 Backup/L2 Mirror/GitHub থেকে পুনরুদ্ধার; Credential পুনরায় প্রবেশ | PoF-D2 |
| **Clear Data** | L1 শূন্য (≈ নতুন Install); Keystore Key-র অবস্থা ডিভাইস/OS-ভেদে অজানা [UA]; SAF Grant সম্ভবত বাতিল [UA] | Credential-ফাইল Key-ছাড়া অপাঠ্য হলে "Vault Reset" ও পুনঃপ্রবেশ (Crash নয়); একই Restore Wizard | PoF-D1, D3 |
| **App Update** | `filesDir`/DB অক্ষত; Schema Migration চলে | Room Auto/Manual Migration + `exportSchema=true` + Migration Test; **Destructive Fallback নিষিদ্ধ**; Migration-এর আগে `VACUUM INTO` দিয়ে DB-Safety-Copy (`noBackupFilesDir`), যাচাই-পর মোছা; v2.4.0→V3 `LegacyStoreMigrator` ধাপে-ধাপে ও পুনরায় চালানো-নিরাপদ (Idempotent) | PoF-D6 |
| **SAF Permission হারালো** | `contentResolver.persistedUriPermissions`-এ Tree নেই বা IO `SecurityException` | Mirror=`DETACHED`; **L1 অপরিবর্তিত**; কোনো Delete প্রপাগেট নয়; UI Re-pick; Re-attach-এর আগে `manifest.projectUuid` মিল যাচাই | PoF-D4 |
| **External Folder মুছে/সরানো** | `DocumentFile.exists()==false` বা Tree URI অকার্যকর | **অনুপস্থিতি ≠ Delete।** Mirror=`MISSING`; সরানো হলে Re-pick + `projectUuid` দিয়ে শনাক্ত; "L1 থেকে পুনঃনির্মাণ"/"Detach" বিকল্প; কোনো নীরব পুনঃসৃষ্টি/Deletion Propagation নয় | PoF-D4 |
| **দুই জায়গায় একই ফাইল পরিবর্তিত** | L1 ও L2 ভিন্ন | Three-Way (Base=`mirror_state.lastSyncedSha256`); `CONFLICT` ⇒ UI Keep-L1/Keep-L2/Merge/Save-both (৬.৭ একই নীতি) | PoF-D5 |
| **Backup অর্ধেকে বন্ধ** | `.part` ফাইল অসম্পূর্ণ | `*.part` → সম্পূর্ণ + Footer যাচাই-পর `rename`; পূর্ববর্তী ভালো Backup **Overwrite হয় না** (≥ ২ Generation); Restore শুরুতেই Footer/Chunk-Index যাচাই — অসম্পূর্ণ হলে প্রত্যাখ্যান; Resume: শেষ সম্পূর্ণ Chunk থেকে (Best-effort) | PoF-B3 |
| **বড় Workspace Backup/Restore** | RAM/সময়/Storage চাপ | Streaming Chunked (৮.৯); Incremental (শুধু নতুন Blob); `WorkManager` + Foreground Service; Restore Staging→সব Hash যাচাই→Atomic Swap (DB সর্বশেষে); পর্যাপ্ত Free-space আগে-যাচাই (`StorageStatsManager`) | PoF-B4 |
| **অন্য Android অ্যাপে ব্যবহার** | Files অ্যাপ/Code Editor | `DocumentsProvider` (৮.৮) বা L2 Mirror-এর মাধ্যমে | PoF-D7 |

### ৮.৭ Master Copy / Source-of-Truth — পরিস্থিতিভিত্তিক সিদ্ধান্ত [PD]

**মূল নীতি: "Master" প্রতি-ফাইল ও পরিস্থিতি-নির্ভর; কোনো Store স্থায়ীভাবে Master নয়।** নির্ধারক: ফাইলের `file_versions` Parent-Hash-Chain-এর সর্বশেষ **Verified** Version।

| পরিস্থিতি | Master | ব্যাখ্যা |
|---|---|---|
| ডিভাইসে স্বাভাবিক কাজ | **L1 Working Tree** (Verified Content) | ArenaPilot-এর কপি; Official Sandbox-এর *চলমান Execution State* Verified না হওয়া পর্যন্ত "Sandbox-ahead", Master নয় |
| SAF Mirror সংযুক্ত, বাইরে সম্পাদনা | প্রতি-ফাইল Three-Way; Global Master নেই | Conflict হলে ব্যবহারকারী |
| GitHub-লিংকড, Share/Release History | **GitHub Branch Head** (Committed History-র জন্য) | L1 = Working Copy; Push-পর `lastPushedCommitSha` |
| Uninstall/Clear Data/নতুন ডিভাইস | সর্বোত্তম Verified উৎস `{L2 Mirror, L3 Backup, GitHub}` | Restore Wizard Manifest-এর `generatedAt`+Hash দিয়ে তুলনা দেখায়; স্বয়ংক্রিয় পছন্দ নয় |
| Backup | **কখনো Master নয়** | Point-in-time Recovery Snapshot |
| Metadata (Room: Memory, Conversation, Checkpoint) | L1 | পুনর্গঠনযোগ্য Subset L3 Backup-এ |

### ৮.৮ `DocumentsProvider` ও SAF — প্রকৃত সক্ষমতা ও সীমাবদ্ধতা

> **কঠোর পার্থক্য [VF-যুক্তি, PoF-D2]:** `DocumentsProvider` তৈরি করা = অন্য অ্যাপকে ArenaPilot-এর L1 Workspace **দেখতে/পড়তে/লিখতে** দেওয়া। এটি Data-কে **Uninstall বা Clear Data থেকে সুরক্ষিত করে না** — ডেটা তখনও App-private Storage-এ; Uninstall হলে Provider ও ডেটা দুটোই চলে যায়। টেকসই কপি পেতে L2 (SAF Mirror) বা L3 (Backup) বা GitHub **আবশ্যক**।

- **Provider নকশা:** `exported=true`, `android:permission="android.permission.MANAGE_DOCUMENTS"`, `grantUriPermissions=true`; শুধু `workspaces/<projectId>/tree` ও `gallery` প্রকাশ; **DB, Vault, Blob Store, `.staging`, Upload Cache কখনো নয়**। প্রতি-Project "Expose to other apps" Toggle (ডিফল্ট বন্ধ)। ডিফল্ট Read-only; Write Opt-in।
- **Security:** `documentId` → Path Resolve-এ Canonical Path ও Root-Prefix যাচাই (Path Traversal/Symlink Escape রোধ); প্রতিটি Provider-Write `CapabilityBroker`-এর Audit-এ (`caller UID/package` সহ); অন্য অ্যাপের Write ⇒ `LOCAL_USER_EDIT`-সদৃশ `EXTERNAL_APP_EDIT` Event ও Conflict-নিয়মের অধীন (Verified Hash ছাড়া Version নয়)।
- **Known Limitations [KL]:** POSIX নেই (অন্য অ্যাপ `File` Path পায় না); প্রতিটি Child Query IPC — বড় Tree-তে ধীর; Rename/Move Atomic নয়; `lastModified`/Size ভরসাযোগ্য নয় ⇒ Hash দিয়ে নিশ্চিত; Android-এর SAF Picker-এ কিছু ডিরেক্টরি (যেমন `Android/data`) নিষিদ্ধ থাকার মতো সীমাবদ্ধতা (সাধারণ জ্ঞান — **[UA]**, PoF-D4/D7-এ নিশ্চিত); কিছু Provider (Cloud) Offline/Stale; Persisted Grant সীমা (৫১২ Android 11+, ১২৮ পূর্বে [RF Secondary]) — অ্যাপ প্রতি Project-এর জন্য ১টি Grant, ব্যবহারকারীকে অতিরিক্ত Mirror-সংখ্যা সীমিত রাখতে (প্রাথমিক ≤ ২০) ও অব্যবহৃত Grant `releasePersistableUriPermission` করতে হবে।
- **SAF Mirror Sync:** Event-ভিত্তিক নয়, **Reconciliation-ভিত্তিক** (App Foreground/Turn-শেষ/ম্যানুয়াল): `(relativePath,size,lastModified,sha256)` তুলনা; বড় Tree-তে Incremental (Changed-hint = `lastModified` → তারপর Hash)। Mirror-এ Write: Temp-নাম→Rename (Provider সমর্থন করলে), নতুবা Direct Write + Hash পুনঃযাচাই।

### ৮.৯ Portable Backup — Format, Crypto ও Restore [PD / PoF-B1…B5]

**লক্ষ্য:** অন্য Android ডিভাইসে Restore; **Android Keystore Key ডিভাইস-বাউন্ড** ⇒ Portable Backup-এ **কখনো ব্যবহৃত হবে না** [VF-সূত্র: Android Keystore Non-exportable Key বৈশিষ্ট্য]।

**Container `.apbackup` (Chunked Authenticated Stream):**
```
[Header: magic "APBK", formatVersion, appVersion, schemaVersion, KDF-id+params, salt(16B+), keySlots[]]
[Chunk 0 … Chunk N-1]  — প্রতিটি: AES-256-GCM, Unique 96-bit Nonce, AAD = headerHash‖chunkIndex‖isLast
[Index: প্রতি Entry (path/kind, blobSha256, size, chunk-range)]
[Footer: Index-hash, total-chunks, SHA-256-all, GCM-tag — "complete" মার্কার]
```
- **Key Hierarchy:** ব্যবহারকারীর **Passphrase** → KDF → KEK; **Random 256-bit DEK** (`SecureRandom`) Chunk এনক্রিপ্ট করে; KEK দিয়ে DEK Wrap (Key-slot-1)। **Recovery Key** (Random 256-bit, Base32/শব্দ-তালিকা রূপে ব্যবহারকারীকে একবার দেখানো/সংরক্ষণ) দিয়ে DEK-র দ্বিতীয় Wrap (Key-slot-2) — **ঐচ্ছিক কিন্তু প্রস্তাবিত**। Passphrase ও Recovery Key **দুটোই হারালে ডেটা অপুনরুদ্ধারযোগ্য; কোনো Escrow নেই** [KL] — UI-তে স্পষ্ট ঘোষণা।
- **KDF সিদ্ধান্ত [Conditional]:** প্রথম পছন্দ **Argon2id** (OWASP-ন্যূনতম m=19 MiB,t=2,p=1 — [RF Secondary], আরও ভালো: ডিভাইস-Benchmark করে ≈ ৫০০ms–১s টার্গেট), কিন্তু Android Platform-এ Built-in নেই [UA] ⇒ Library লাগবে (যেমন libsodium-Binding বা Bouncy Castle) — Maintenance/APK-আকার/Licence মূল্যায়ন **PoF-B1**। **Fallback: PBKDF2-HMAC-SHA256 ≥ ৬০০,০০০ iteration** (`SecretKeyFactory`, নির্ভরতা-মুক্ত)। KDF-id ও Params Header-এ থাকে ⇒ ভবিষ্যতে Backward-compatible আপগ্রেড।
- **Integrity:** প্রতি Chunk AEAD (Tamper/Reorder/Truncate সনাক্ত — AAD-তে `chunkIndex` ও `isLast`); Footer-এ Index-Hash; Restore-এ প্রথমে Header+Index+Footer যাচাই (Dry-run), তারপর Content।
- **কী থাকবে:** Project Metadata, Workspace Tree, `file_versions` (ঐচ্ছিক—আকার-নিয়ন্ত্রণে), Memories, Conversation/Turn Ledger (ঐচ্ছিক—সংবেদনশীল তাই ব্যবহারকারী-নির্বাচিত), Task Checkpoints, Settings (Non-secret), Uploaded Artifacts/Gallery (ঐচ্ছিক), GitHub **লিংক** (owner/repo/branch/lastPushedCommit — Token নয়), MCP **Server সংজ্ঞা** (`apiKey` ফাঁকা)।
- **কী বাদ যাবে (কখনো না):** GitHub PAT, MCP API Key, Arena Session Cookie/WebView Storage, Keystore Material, Vault ফাইল, Cache, অনাথ Blob, SAF URI Grant।
- **Restore পদ্ধতি:** (১) File Pick + Passphrase/Recovery Key ⇒ Header MAC যাচাই; (২) Dry-run সারাংশ (Schema/App Version সামঞ্জস্য — নতুন Schema থেকে পুরোনো অ্যাপে Restore **প্রত্যাখ্যাত**); (৩) `restore_tmp/`-এ Staging, সব Blob Hash যাচাই; (৪) Atomic Swap (Room-ফাইল সর্বশেষে/Transaction-এ); (৫) **Post-restore "Reconnect" চেকলিস্ট:** Arena-য় WebView-তে Sign-in; GitHub PAT পুনঃপ্রবেশ ও `GET /user` যাচাই (Link-গুলো `NEEDS_AUTH`); MCP Key পুনঃপ্রবেশ; SAF Mirror `DETACHED` ⇒ Re-pick ও `projectUuid` মিল যাচাই; `expectedHead` পুনঃসংগ্রহ।
- **Auto Backup (Android Cloud Backup):** V3.0-এ `allowBackup="false"` **বহাল** [Proposed]। যুক্তি: Official সীমা ২৫ MB [RF], ডিভাইস-বাউন্ড Keystore Ciphertext অন্য ডিভাইসে অপাঠ্য, অনিয়ন্ত্রিত Credential/Session Leakage ঝুঁকি। ভবিষ্যতে শুধু Non-secret ছোট Settings-এর জন্য `dataExtractionRules` দিয়ে নির্বাচিত Include বিবেচনাযোগ্য (Conditional, PoF-B5)।
- **Auto Local Snapshot:** প্রতি N দিন/মাইলস্টোনে Opt-in স্বয়ংক্রিয় Backup, ব্যবহারকারী-নির্বাচিত L3 গন্তব্যে (SAF Tree); ≥ ২ Generation Retention।

### ৮.১০ Storage-সংক্রান্ত PoF তালিকা (Appendix A বিস্তারিত)
`D1` Clear Data-এ Keystore Key ও Vault আচরণ · `D2` Uninstall→Reinstall-এ L2 ফাইল ও Grant · `D3` Clear Data-এ SAF Grant · `D4` SAF Grant-সীমা/Folder-মোছা/সরানো · `D5` দুই-স্থানে Edit Conflict · `D6` v2.4.0→V3 Upgrade (বাস্তব APK-তে) · `D7` অন্য App (Files/Editor) থেকে Provider ব্যবহার, Large Tree Perf · `B1` KDF (Argon2id লাইব্রেরি বনাম PBKDF2) Benchmark · `B2` Cross-device Restore · `B3` Interrupted Backup · `B4` বড় (≥ ২ GB) Workspace · `B5` Auto Backup `dataExtractionRules` Dry-run।

---

## 9. Memory ও Project System Specification

Memory এবং Projects দুটি আলাদা কিন্তু পরস্পর সমন্বিত Persistent Subsystem হিসেবে কাজ করবে।

### ৯.১ Memory System (দ্বি-স্তরীয় ও নিয়ন্ত্রণযোগ্য মেমরি)

1. **দুই ধরনের মেমরি স্কোপ (Memory Scopes):**
   - **`GLOBAL` Memory:** ব্যবহারকারীর সাধারণ পছন্দ, ভাষা, কোডিং স্টাইল বা ব্যক্তিগত নির্দেশনা যা সব প্রজেক্ট ও মোডে (Image Mode বাদে) প্রযোজ্য হতে পারে।
   - **`PROJECT` Memory:** শুধুমাত্র একটি নির্দিষ্ট `projectId`-এর জন্য প্রযোজ্য তথ্য (যেমন ওই প্রজেক্টের আর্কিটেকচারাল নিয়ম, API কনভেনশন বা ডোমেইন নলেজ)।
2. **উৎস ও নিয়ন্ত্রণযোগ্যতা (Provenance & User Control):**
   - প্রতিটি মেমরি এন্ট্রিতে থাকবে: `id`, `scope` (`GLOBAL` | `PROJECT`), `projectId` (nullable), `key`, `content`, `category` (`preference` | `fact` | `instruction` | `code_convention`), `importance` (`always` | `contextual`), `sourceConversationId`, `sourceMode`, `userVerified` (boolean), `createdAt`, `updatedAt`।
   - **Privacy Opt-In Default:** মেমরি ইনজেকশন ডিফল্টভাবে **বন্ধ (`OFF`)** থাকবে। ব্যবহারকারী চালু করলে তবেই মেমরি ব্যবহৃত হবে।
   - যখন মডেল নতুন কোনো মেমরি সংরক্ষণের প্রস্তাব দেয় (`<AP:MEMORY_SUGGEST>`), তখন ব্যবহারকারীকে একটি ছোট টোস্ট/কার্ডে দেখানো হবে যাতে তিনি চাইলে ১ ট্যাপে Approve, Edit বা Reject করতে পারেন।
   - মেমরি স্ক্রিন থেকে সব মেমরি ফিল্টার, সার্চ, এডিট, ডিলিট এবং JSON/Markdown হিসেবে এক্সপোর্ট/ইমপোর্ট করা যাবে।

### ৯.২ Project System (পূর্ণাঙ্গ মাল্টি-সেশন ওয়ার্কস্পেস)

1. **Project Entity-এর গঠন:**
   প্রতিটি প্রজেক্টে থাকবে:
   - `id`, `name`, `description`, `defaultMode` (`TEXT` | `CODE` | `SEARCH`), `customInstructions`
   - **Workspace Files (`workspaces/<projectId>/tree/`):** প্রজেক্টের নিজস্ব ফাইল ও ডিরেক্টরি ট্রি।
   - **Project-Scoped Memories:** শুধুমাত্র ওই প্রজেক্টের মেমরি।
   - **Linked GitHub Repository (ঐচ্ছিক):** `owner`, `repo`, `activeBranch`, `lastSyncedCommitSha`।
   - **Linked SAF DirectoryUri (ঐচ্ছিক):** ফোনের স্থানীয় ফোল্ডারের সাথে সিঙ্ক লিংক।
   - **Active Task State (`PLAN.md`, `PROGRESS.md`, `TaskCheckpoint`):** দীর্ঘমেয়াদি কাজের অগ্রগতি।
   - **Bound Conversations:** এই প্রজেক্টের অধীনে চলা সকল চ্যাট সেশনের (`conversationId`) তালিকা।
2. **কঠোর প্রজেক্ট আইসোলেশন (Strict Project Isolation Guarantee):**
   - যখন ব্যবহারকারী `Project A` নির্বাচন করে চ্যাট করছেন, তখন শুধুমাত্র `GLOBAL` মেমরি এবং `Project A`-এর মেমরি ও ফাইল ব্যবহৃত হবে।
   - **`Project B`-এর কোনো ফাইল, মেমরি, রিপোজিটরি বা কনটেক্সট কখনোই `Project A`-এর সেশনে প্রবেশ করতে পারবে না।**
   - প্রতিটি `/c/{conversationId}` তার নিজস্ব `projectId`-এর সাথে ডাটাবেসে বাঁধা থাকবে; ব্যবহারকারী পুরোনো চ্যাট খুললে অ্যাপ স্বয়ংক্রিয়ভাবে সংশ্লিষ্ট প্রজেক্ট কনটেক্সট সক্রিয় করবে।
3. **Project Backup, Export & Import:**
   - যেকোনো প্রজেক্টকে এক ক্লিকে একটি স্বয়ংসম্পূর্ণ `.approject.zip` ফাইল হিসেবে এক্সপোর্ট করা যাবে (যাতে `project.json`, `memories.json`, `checkpoints.json`, এবং সম্পূর্ণ `tree/` ফোল্ডার থাকবে, কিন্তু কোনো গোপন টোকেন থাকবে না) এবং যেকোনো ডিভাইসে ইমপোর্ট করা যাবে।

### ৯.৩ Revision R1 — Errata ও নির্দেশ
- **ফিল্ড-নাম/Enum:** §৯.১-এর `key`/`content`/`importance=contextual` Schema-র `mem_key`/`mem_value`/`CONTEXTUAL` (Enum `ALWAYS | CONTEXTUAL`) অনুযায়ী (§১২.৩ E1–E2)। Default-Mode Enum একীভূত `Modality` (E3)।
- **Isolation:** শুধু FK নয় — `scope_key` UNIQUE + `CHECK` (E13) + DAO-স্তরে বাধ্যতামূলক `projectId` + `MemoryAndProjectIsolationTest` (Fuzz)।
- **Memory Data-Flow সত্য:** Memory Prompt-এ ঢুকলে Arena-র সার্ভারে যায় — ডিফল্ট OFF (বহাল) ও ব্যবহারকারীকে স্পষ্ট জানানো।
- **`.approject.zip`:** Backup ফরম্যাটের (`.apbackup`, §৮.৯) Project-স্তর Subset হিসেবে একই Crypto ঐচ্ছিকভাবে প্রযোজ্য; Token-বর্জিত নীতি বহাল। `<AP:MEMORY_SUGGEST>` → `APH/1` (§৫.৪.৩)।

---

## 10. File Upload ও Multi-Format File Analysis Pipeline

### ১০.১ মূল সমস্যা ও V3 আর্কিটেকচারাল সমাধান
অডিটে প্রমাণিত হয়েছে যে `arena.ai`-এর নিজস্ব `<input type="file">` শুধুমাত্র ছবি (`image/png, image/jpeg, image/webp`) গ্রহণ করে এবং অন্য সব ফরম্যাট (`PDF`, `DOCX`, `XLSX`, `PPTX`, `ZIP` ইত্যাদি) প্রত্যাখ্যান করে। তাই V3-তে একটি পূর্ণাঙ্গ **Native Android File Analysis & Context Delivery Pipeline (`FileAnalysisEngine.kt`)** তৈরি করা হবে।

**কঠোর সততা নীতি (Honest Analysis Rule):** কোনো ফাইলের বাইটস প্রকৃতপক্ষে পার্স বা রিড না করে কখনোই সেটিকে "বিশ্লেষিত" বলে দাবি করা যাবে না। পার্সিং ব্যর্থ হলে (যেমন পাসওয়ার্ড-প্রটেক্টেড PDF বা ক্ষতিগ্রস্ত আর্কাইভ) ব্যবহারকারী এবং মডেল উভয়কেই সুস্পষ্ট কারণ (`ENCRYPTED_PDF`, `CORRUPT_ARCHIVE`, `OCR_REQUIRED`) জানাতে হবে।

### ১০.২ ফরম্যাট অনুযায়ী ফাইল প্রসেসিং কৌশল (Format-by-Format Strategy)

| ফাইল ফরম্যাট | ডেলিভারি পথ (Delivery Path) | নেটিভ প্রসেসিং ও পার্সিং কৌশল (`FileAnalysisEngine.kt`) | বড় ফাইলের কৌশল (Large File Strategy) |
|---|---|---|---|
| **Images (`PNG`, `JPG`, `WEBP`, `HEIC`, `AVIF`, `GIF`, `BMP`)** | **Native Site `<input type="file">`** (যাতে মাল্টিমোডাল ভিশন মডেল সরাসরি পিক্সেল দেখে) | EXIF রোটেশন ঠিক করা, `HEIC`/`AVIF`/`BMP`-কে উচ্চমানের `JPEG`/`WEBP`-তে রূপান্তর করা, এবং প্রয়োজনে 2048px বাউন্ডারিতে রিসাইজ করে `NativeBlobStore` (`/___sd/blob/<token>`) দিয়ে পেজের ফাইল ইনপুটে প্রদান। | প্রতি মেসেজে সর্বোচ্চ ১০টি ছবি; ফোল্ডার পিকের ক্ষেত্রে প্রথম ৩০টি ছবি এবং বাকিগুলোর তালিকা। |
| **PDF Documents (`.pdf`)** | **Hybrid (Extracted Markdown + Page Image Rendering)** | ১) Kotlin-এ PDF টেক্সট ও মেটাডেটা এক্সট্র্যাক্টর দিয়ে প্রতিটি পৃষ্ঠার টেক্সট (`[Page 1] ... [Page N]`) নিষ্কাশন।<br>২) যদি কোনো পৃষ্ঠায় টেক্সট না থাকে (স্ক্যান করা PDF বা চার্ট-সমৃদ্ধ পৃষ্ঠা), তবে Android-এর নেটিভ `android.graphics.pdf.PdfRenderer` দিয়ে সেই পৃষ্ঠাগুলোকে ছবি (`PNG`) হিসেবে রেন্ডার করে ভিশন মডেলে পাঠানো! | ২০ পৃষ্ঠার কম হলে পূর্ণ টেক্সট; ২০ পৃষ্ঠার বেশি হলে সূচিপত্র + প্রথম ও প্রাসঙ্গিক পৃষ্ঠাগুলো (BM25) এবং অন-ডিমান্ড `<AP:READ_UPLOAD id="..." pages="21-30"/>` টুল। |
| **Word Documents (`.docx`)** | **Structured Markdown Injection + Local Chunk Index** | `.docx` মূলত একটি ZIP আর্কাইভ যার ভেতরে `word/document.xml` থাকে। নেটিভ Kotlin `ZipInputStream` + `XmlPullParser` দিয়ে শিরোনাম (`Heading`), অনুচ্ছেদ, বুলেট লিস্ট এবং টেবিল (`<w:tbl>`) অবিকল Markdown টেবিলে রূপান্তর করা হবে। | ৫০ KB-এর নিচে হলে সরাসরি স্ট্রাকচার্ড কনটেক্সট; বড় হলে চ্যাঙ্ক ইনডেক্সিং + অন-ডিমান্ড রিড। |
| **Spreadsheets (`.xlsx`, `.csv`, `.tsv`)** | **Sheet Summary + Markdown Table + Sandbox Sync** | `.xlsx`-এর `xl/sharedStrings.xml` ও `xl/worksheets/sheet*.xml` নেটিভভাবে পার্স করে প্রতিটি শিটের নাম, কলাম স্কিমা, রো সংখ্যা, ফর্মুলা এবং ডেটা প্রিভিউ তৈরি করা হবে। Code/Search মোডে ফাইলটি স্যান্ডবক্সেও পাঠানো যাবে। | ছোট শিট (≤ ২০০ রো) পূর্ণ Markdown টেবিল হিসেবে; বড় শিট (> ২০০ রো) স্কিমা + কলাম স্ট্যাটিস্টিকস + প্রথম ৫০ রো + কোয়েরি টুল। |
| **Presentations (`.pptx`)** | **Slide-by-Slide Markdown Extraction** | `.pptx`-এর `ppt/slides/slide*.xml` ও `ppt/notesSlides/notesSlide*.xml` নেটিভভাবে পার্স করে `[Slide 1] ... [Slide N]` ও স্পিকার নোট নিষ্কাশন। | সব স্লাইডের টেক্সট ও নোট সংক্ষিপ্ত আকারে প্রদান। |
| **Code & Text Files (`.kt`, `.ts`, `.py`, `.json`, `.md`, `.xml`, `.sql`, `.log`, ইত্যাদি)** | **Structured `<AP:ATTACHED_FILE>` Context + Workspace Import** | UTF-8/Charset ডিটেকশন, লাইন নম্বর যোগ করা এবং সিনট্যাক্স-সচেতন চ্যাঙ্কিং। Code Mode-এ ফাইলগুলো স্বয়ংক্রিয়ভাবে সক্রিয় প্রজেক্ট ওয়ার্কস্পেসেও যুক্ত করার অপশন থাকবে। | ১,০০০ লাইনের নিচে পূর্ণ ফাইল; এর বড় হলে ফাইল আউটলাইন (ক্লাস/ফাংশন সিগনেচার) + প্রাসঙ্গিক অংশ + `<AP:READ_UPLOAD>` টুল। |
| **Archives & Folders (`.zip`, `.tar.gz`, SAF Folder)** | **Tree Indexing + Selective Extraction** | নেটিভ স্ট্রিমিং এক্সট্র্যাক্টর দিয়ে `filesDir/uploads/<artifactId>/tree/`-তে আনপ্যাক করা (`node_modules`, `.git`, `build` বাদ দিয়ে)। Zip-slip পাথ ট্রাভার্সাল ও Zip-bomb গার্ড সক্রিয় থাকবে। | পুরো ফাইল ট্রি + প্রধান ফাইলগুলোর সারাংশ প্রম্পটে যাবে এবং বাকি ফাইল অন-ডিমান্ড পড়া হবে। |

### ১০.৩ Uploaded Files-এর Context Management, Preview, Reuse ও Cleanup
1. **Attachment Tray & Preview:** কমপোজারের ওপরে একটি নেটিভ/ওভারলে **Attachment Tray** থাকবে যেখানে সংযুক্ত প্রতিটি ফাইলের নাম, আকার, পার্সিং স্ট্যাটাস (`Parsed 14 pages`, `3 sheets`, `42 files`) এবং প্রিভিউ বাটন থাকবে। ব্যবহারকারী পাঠানোর আগেই দেখে নিতে পারবেন AI ফাইলটি থেকে কী টেক্সট পাচ্ছে।
2. **Reuse Across Turns & Projects:** একবার আপলোড ও পার্স করা ফাইল `uploaded_artifacts` টেবিলে ক্যাশ থাকে। ব্যবহারকারী **"Recent Uploads"** তালিকা থেকে পুনরায় ফাইলটি যেকোনো চ্যাটে বা প্রজেক্টে ১ ট্যাপে ব্যবহার করতে পারবেন—বারবার ফাইল পিক বা পার্স করতে হবে না।
3. **Privacy, Permission Control & Temporary Cleanup:**
   - প্রতিটি ফাইলের জন্য স্পষ্ট অ্যাক্সেস কন্ট্রোল থাকবে (`Current Conversation Only` বনাম `Saved in Project`)।
   - অস্থায়ী আপলোড (`Current Conversation Only`) সেশন শেষ হওয়ার ২৪ ঘণ্টা পর `WorkManager` ক্লিনআপ জবের মাধ্যমে স্বয়ংক্রিয়ভাবে মুছে যাবে (`cleanupExpiredUploads()`)।

### ১০.৪ Revision R1 — প্রকৃত Parser সক্ষমতা, Library সিদ্ধান্ত ও Fallback

> **§১০.২ Errata:** (ক) PDF সারিতে "`PdfRenderer` দিয়ে টেক্সট এক্সট্র্যাক্টর" — `PdfRenderer` (API 21–34) **টেক্সট দেয় না** [VF Official, ২.৬]। (খ) PPTX: `ppt/slides/slide*.xml` ফাইলনামের ক্রম **Slide-ক্রম নয়**; ক্রম `ppt/presentation.xml`-এর `sldIdLst` + Relationships থেকে পড়তে হবে। XLSX Sheet-ক্রম একইভাবে `xl/workbook.xml` থেকে। (গ) "ZIP/XML পার্স করলেই DOCX/XLSX/PPTX সম্পূর্ণ নির্ভুল সমর্থিত" — **দাবি বাতিল**; নিচে প্রতিটির Supported/Unsupported Feature তালিকা। (ঘ) HEIC/AVIF রূপান্তর ডিভাইস/API-ভেদে ভিন্ন [UA→PoF-P6]।

**Support Level পরিভাষা:** `BASIC_TEXT` (সাধারণ টেক্সট/কাঠামো, নির্ধারিত সীমাবদ্ধতাসহ) · `BEST_EFFORT` (লেআউট-নির্ভর; ভুল সম্ভব, Fidelity Report সহ) · `UNSUPPORTED`। **কোনো Format-কে "Fully/100% Supported" বলা যাবে না।** প্রতিটি পার্সিংয়ের পর **Fidelity Report** (কী নিষ্কাশিত, কী বাদ, কত পৃষ্ঠা/শিট/স্লাইড সফল) Attachment Tray-তে ও মডেল-Context-এর শুরুতে যাবে (Honest Analysis Rule)।

#### ১০.৪.১ PDF

| বিষয় | সত্য | সিদ্ধান্ত [PD] |
|---|---|---|
| Render বনাম Text | `PdfRenderer` (≤API 34) = Page→Bitmap; Text API (`getTextContents`, `searchText`, `selectContent`) **API 35+** [VF]; Android 12–14-এ SDK Extension ≥ ১৩ থাকলে `PdfRendererPreV` [RF Secondary] | **Tiered Extractor:** T1 প্ল্যাটফর্ম (API ≥ 35 বা Ext ≥ 13 `SdkExtensions.getExtensionVersion(S)`) · T2 Library-ভিত্তিক (বাকি সব, বিশেষত `minSdk=26`) · T3 Scanned-এর জন্য OCR/Vision |
| API 26–34-এর Text | প্ল্যাটফর্মে নেই | **Library লাগবে — Conditional:** প্রার্থী PDFBox-Android (Licence/আকার/মেমরি R1-এ যাচাই হয়নি **[UA]**; ধারণা: বড় ও মেমরি-ভারী, Complex-Script ও বড় PDF-তে ধীর — PoF-P1), PDFium-Binding (Native; Text API, আকার ও Licence যাচাই-সাপেক্ষ **[UA]**), MuPDF/iText **AGPL ⇒ Repository-র `LICENSE` ও Distribution-এর সাথে সামঞ্জস্য না হলে বর্জিত**। নির্বাচন PoF-P1 ফলাফলে |
| Scanned PDF | Text Layer নেই ⇒ Extraction খালি | **শনাক্তকরণ:** Page-প্রতি Text < Threshold। **Fallback ক্রম:** (১) মডেল Image-Input সমর্থন করলে (Catalog `inputCapabilities.image` [VF]) Page→Image (সীমিত DPI, ≤ ১০ ছবি/মেসেজ) পাঠানো; (২) On-device OCR — **ML Kit Text Recognition Bengali সমর্থন করে কি না যাচাই-সাপেক্ষ [UA→PoF-P2]**, Tesseract (`ben`+`eng` traineddata, ব্যবহারকারী-ডাউনলোড) প্রার্থী; (৩) অন্যথায় স্পষ্ট "OCR অনুপলব্ধ" |
| বাংলা বনাম ইংরেজি | ইংরেজি Unicode PDF সাধারণত ভালো; **বাংলা PDF-এ ঝুঁকি:** (ক) Legacy ASCII-ফন্ট-এনকোডেড (Bijoy/SutonnyMJ-ধরনের) PDF Text Extract-এ অর্থহীন Latin-অক্ষর দেয়; (খ) ToUnicode CMap অনুপস্থিত/ভুল; (গ) যুক্তাক্ষর/Reordering (Complex Script) ভাঙা | Accuracy **অপরিমাপিত [UA]**। PoF-P1: ≥ ২০ বাস্তব বাংলা PDF (Unicode, Legacy-Font, Scanned, মিশ্র) ও ≥ ২০ ইংরেজি; মেট্রিক: Character-Error-Rate বনাম Ground-truth। **Garbage-Detector** (Bengali-Unicode-Block-অনুপাত/Dictionary-Hit) ⇒ OCR/Vision Fallback |
| Table/Multi-column | Text Extractor Reading-Order ভাঙে; Table-কাঠামো হারায় | `BEST_EFFORT`; Position-sorted Extraction ও Column-heuristic; Table ⇒ সরল Text + Page-Image বিকল্প (Vision); "Table পুনর্গঠিত" দাবি নয় |
| বড় PDF | Bitmap মেমরি ≈ W×H×4 বাইট/পৃষ্ঠা (A4@150dpi ≈ ৮–৯ MB) | Page-by-Page Streaming, একসাথে ≤ ১ Bitmap, `recycle()`; সীমা: প্রাথমিক ≤ ২০০ পৃষ্ঠা/কাজ (Chunked Continue); **আলাদা Process (`:parse`) ও Timeout/OOM-Containment** — Crash-এ Main App অক্ষত |
| Password-protected | `PdfRenderer` `SecurityException` দেয়; Library `InvalidPassword` | ব্যবহারকারীকে পাসওয়ার্ড চাওয়া (**কখনো সংরক্ষিত নয়**, Memory-তে মাত্র); ভুল ⇒ পুনরায়; বাতিল ⇒ `PARSE_FAILED: ENCRYPTED` |
| Corrupt | — | সম্ভাব্য আংশিক পৃষ্ঠা + ত্রুটি-তালিকা; `parse_status=PARTIAL/FAILED`; কখনো "বিশ্লেষিত" নয় |

#### ১০.৪.২ Office ও অন্যান্য Format

| Format | পদ্ধতি | Supported (`BASIC_TEXT`) | Unsupported/সীমাবদ্ধতা [KL] | Library সিদ্ধান্ত |
|---|---|---|---|---|
| **DOCX** | ZIP + `XmlPullParser` (Streaming) | Heading/Paragraph/List(Basic)/Table(সরল)/Hyperlink Text/Footnote Text | Text-box, SmartArt, Chart, Equation, Complex Merged-cell Table, Tracked-change (নীতি: **Final View**, `w:del` বাদ — Fidelity Report-এ উল্লেখ), Field/TOC আপডেট, Header/Footer (ঐচ্ছিক), Embedded OLE, Password-encrypted | Apache POI Android-এ ভারী/সামঞ্জস্য-ঝুঁকিপূর্ণ ⇒ **Hand-written Parser + Test Corpus** (PoF-P3); সিদ্ধান্ত পরিবর্তন-যোগ্য |
| **XLSX** | ZIP + SAX/Pull (Streaming); Sheet-ক্রম `workbook.xml` | Sheet-নাম, Cell Value (Cached `<v>`), Shared/Inline String, তারিখ (Style numFmt-নির্ভর শনাক্ত), Merged-range সূচক | **Formula পুনর্গণনা নেই** (Cached Value ব্যবহার; অনুপস্থিত হলে Formula-টেক্সট), Pivot/Chart/Macro, Conditional-format, Hidden Sheet (চিহ্নিত), Password-encrypted (OLE-wrapped) | Streaming + Row-cap (প্রাথমিক ২,০০০ রো/শিট নমুনা + Schema + পরিসংখ্যান); PoF-P3 |
| **PPTX** | ZIP + XML; Slide-ক্রম `presentation.xml` | Slide Title/Text/Notes | SmartArt, Chart, Grouped-shape ক্রম, Image-ভিত্তিক Text (OCR/Vision বিকল্প), Animation | Hand-written; PoF-P3 |
| **CSV/TSV** | RFC 4180 Streaming | Quoted-newline, Delimiter-sniff, Encoding (UTF-8/BOM, UTF-16, Windows-1252 শনাক্ত) | অসম Column, বিশাল ফাইল ⇒ Head/Tail নমুনা + Column-পরিসংখ্যান | `commons-csv` প্রার্থী বা Hand-written |
| **ZIP / TAR.GZ** | `java.util.zip`; TAR.GZ-র জন্য Repo-র বিদ্যমান `TarGz.kt` পুনর্ব্যবহার (Sandbox Decommission-এ **মোছা নয়**) | Tree-তালিকা, নির্বাচিত Extract | **Zip-slip** (Canonical-Path-Prefix যাচাই), **Zip-bomb** (Total-size, Compression-ratio, Entry-সংখ্যা, Nesting-depth সীমা), Symlink বাদ, Encrypted Zip ⇒ Unsupported, Nested Archive অটো-Expand নয় | Standard Library; PoF-P4 |
| Legacy `.doc/.xls/.ppt` (OLE2), `.rtf`, `.odt` | — | — | **Unsupported (V3.0)**; ব্যবহারকারীকে DOCX/PDF-এ রূপান্তরের পরামর্শ | — |
| Images | `ImageDecoder`/`BitmapFactory` | PNG/JPEG/WEBP | HEIC/AVIF Decode ডিভাইস/API-ভেদে [UA→PoF-P6]; Fallback ⇒ "রূপান্তর অসম্ভব" | — |

#### ১০.৪.৩ Parser নিরাপত্তা ও Isolation [PD]
সব Parser **Untrusted Input** ধরে: আলাদা `:parse` Process (Crash/OOM Containment), CPU/Time/Memory Budget, Entity-Expansion বন্ধ (XML External Entity/DTD নিষ্ক্রিয়), Output-সীমা; Parsed Text Model-Context-এ যাওয়ার আগে **Untrusted-Content Fencing** (১৩.৬ — Prompt Injection)।

#### ১০.৪.৪ Parser PoF তালিকা
`P1` PDF Text (বাংলা/ইংরেজি, Legacy-Font, Table/Column) ও Library তুলনা (Accuracy, আকার, মেমরি, সময়, Licence) · `P2` OCR (Bengali) প্রার্থী তুলনা · `P3` DOCX/XLSX/PPTX Corpus (প্রতিটি ≥ ২০ বাস্তব ফাইল, Known-feature Matrix) · `P4` ZIP/TAR Security Tests · `P5` বড় PDF Performance/Memory (`:parse` Process) · `P6` HEIC/AVIF Decode সমর্থন (API 26/28/31/34/35 ডিভাইস)।

---

## 11. Native Settings ও Application Experience

### ১১.১ বর্তমান Settings সমস্যার সমাধান
v2.2.0-এ মিনিফাইড `content.js`-এর সেটিংস ছাঁটাই করতে গিয়ে GitHub Token এবং Backup/Restore অপশনগুলো সম্পূর্ণ হারিয়ে গেছে, আর `UiPolish.kt` প্রতিবার DOM মিউটেশনে রেগুলার এক্সপ্রেশন চালিয়ে সেটিংস লুকানোর চেষ্টা করে।

V3-তে Settings হবে **সম্পূর্ণ Native Android Architecture-চালিত (`SettingsActivity` / `SettingsBottomSheetDialogFragment`)**, যা সরাসরি Kotlin `SettingsRepository` (Jetpack DataStore + Room + `EncryptedCredentialVault`)-এর সাথে যুক্ত থাকবে।

### ১১.২ সুসংগঠিত ৯টি Native Settings বিভাগ (9 Settings Categories)

1. **Direct Mode & Model Defaults:**
   - ডিফল্ট লঞ্চ মোড (`Last Used`, `Text`, `Code`, `Search`, `Image`)।
   - প্রতিটি মোডের জন্য আলাদা Context Budget ও Auto-Continue টগল।
2. **Code Mode & Official Sandbox Sync:**
   - `Auto-Sync Official Sandbox Files to Device Storage` (On/Off, Default: `ON`)।
   - `Create Turn Snapshots Automatically` (On/Off, Default: `ON`)।
   - `Auto-Hydrate Workspace on Sandbox Reset` (`Ask` / `Auto`)।
   - Default Workspace Storage Location ও SAF Folder Link।
3. **GitHub Integration & Credentials:**
   - GitHub Personal Access Token ইনপুট (Android Keystore-এ এনক্রিপ্টেড)।
   - **"Verify Token & Check Rate Limit"** বাটন (লাইভ ইউজারনেম, স্কোপ ও অবশিষ্ট কোটা প্রদর্শন)।
   - Default Commit Author Name & Email, Default Push Mode (`Ask before every push` / `Auto-push to feature branch`)।
4. **Projects & Workspaces:**
   - সকল প্রজেক্টের তালিকা, নতুন প্রজেক্ট তৈরি, ডিলিট, আর্কাইভ এবং `.approject.zip` এক্সপোর্ট/ইমপোর্ট।
5. **Memory & Privacy Controls:**
   - `Enable Memory Injection` (Default: `OFF` — Opt-in)।
   - `Auto-Suggest New Memories` (On/Off)।
   - `Enable App System Instructions` (Default: `ON` for Text/Code/Search; Always `OFF` for Image)।
   - Global বনাম Project Memory ম্যানেজার, ক্লিয়ার ও এক্সপোর্ট।
6. **Prompts, Personas & Skills:**
   - সিস্টেম প্রম্পট প্রোফাইল, কাস্টম পারসোনা এবং স্কিল লাইব্রেরি (Office Skill ট্রিগার মোড: `Strict Explicit Only` / `Off`)।
7. **MCP Servers & External Tools:**
   - MCP সার্ভার তালিকা (`name`, `serverUrl`, `transport`: Streamable HTTP 2025/2026, Keystore-backed `apiKey`)।
   - **"Test Connection & Discover Tools"** বাটন এবং প্রতিটি টুলের পারমিশন (`Auto-run` / `Ask before running`)।
8. **Storage, File Management & Backup:**
   - স্টোরেজ ব্যবহারের বিস্তারিত হিসাব (Workspaces, Uploads Cache, Image Gallery, Database)।
   - `Clear Temporary Upload Cache`, `Export Full Encrypted Backup (.apbackup)`, `Restore from Backup`।
9. **System, Language, Updates & Diagnostics ("Doctor"):**
   - অ্যাপ ও AI রেসপন্স ভাষা (` বাংলা `, `English`, `System Auto`)।
   - In-App Updater (`UpdateChecker.kt` — স্টেবল রিলিজ চ্যানেল)।
   - **Live System Doctor:** WebView, Arena DOM Selectors, Official Sandbox Stream Hook, Storage, GitHub Token ও MCP সার্ভারের রিয়েল-টাইম হেলথ চেক।

---

## 12. Data Model, Room SQLite Schema, Storage Lifecycle ও Migration Strategy

### ১২.১ Room SQLite Database Schema (`arenapilot_v3.db`)

> **R1:** §১২.১ DDL ঐতিহাসিক রেফারেন্স; অসংগতি (E1–E13) §১২.৩.১-এ, **নরমেটিভ Schema §১২.৩.২**।

```sql
-- ১. Projects Table
CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    default_mode TEXT NOT NULL DEFAULT 'CODE', -- TEXT | CODE | SEARCH
    custom_instructions TEXT NOT NULL DEFAULT '',
    workspace_rel_path TEXT NOT NULL,          -- workspaces/<id>/tree
    saf_tree_uri TEXT,                         -- Optional linked Android SAF folder URI
    github_repo_id TEXT,                       -- FK -> github_repos.id
    active_task_checkpoint_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- ২. Project Files Metadata & Hash Index
CREATE TABLE project_files (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    is_binary INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'SYNCED', -- SYNCED | MODIFIED_LOCAL | MODIFIED_SANDBOX | CONFLICT
    last_modified_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, relative_path)
);

-- ৩. Full-Text Search Virtual Table for Project Files
CREATE VIRTUAL TABLE project_files_fts USING fts4(
    project_id,
    relative_path,
    content_text
);

-- ৪. Official Sandbox Snapshots (Per-Turn Version History)
CREATE TABLE sandbox_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    summary TEXT NOT NULL,
    manifest_json TEXT NOT NULL,               -- List of {path, sha256, action}
    snapshot_rel_dir TEXT NOT NULL,            -- workspaces/<projectId>/snapshots/<id>
    created_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ৫. Scoped Memories Table
CREATE TABLE memories (
    id TEXT PRIMARY KEY NOT NULL,
    scope TEXT NOT NULL,                       -- GLOBAL | PROJECT
    project_id TEXT,                           -- NULL if GLOBAL, FK if PROJECT
    mem_key TEXT NOT NULL,
    mem_value TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'fact',     -- preference | fact | instruction | code_convention
    importance TEXT NOT NULL DEFAULT 'called', -- always | called
    source_conversation_id TEXT,
    source_mode TEXT,
    user_verified INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ৬. Conversations & Modality Persistence
CREATE TABLE conversations (
    id TEXT PRIMARY KEY NOT NULL,              -- Arena evaluation ID from /c/{id}
    title TEXT NOT NULL DEFAULT '',
    modality TEXT NOT NULL DEFAULT 'chat',     -- chat | webdev | search | image
    model_id TEXT,
    project_id TEXT,                           -- Bound project (nullable)
    turn_count INTEGER NOT NULL DEFAULT 0,
    system_prompt_injected INTEGER NOT NULL DEFAULT 0,
    last_active_at INTEGER NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- ৭. Conversation Turns (Replaces volatile 16-item sdsArenaRing)
CREATE TABLE conversation_turns (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    role TEXT NOT NULL,                        -- USER | ASSISTANT | TOOL_RESULT
    raw_content TEXT NOT NULL,                 -- Exact un-rendered markdown / tool tags
    original_user_prompt TEXT,                 -- Clean user prompt before injection
    finish_reason TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- ৮. Long-Running Task Checkpoints
CREATE TABLE task_checkpoints (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT,
    conversation_id TEXT NOT NULL,
    state TEXT NOT NULL,                       -- PLANNING | EXECUTING_SANDBOX | VERIFYING | COMMITTING | PAUSED | COMPLETED | FAILED
    plan_markdown TEXT NOT NULL DEFAULT '',
    progress_markdown TEXT NOT NULL DEFAULT '',
    last_verified_step INTEGER NOT NULL DEFAULT 0,
    pending_tool_call_json TEXT,
    last_error TEXT,
    updated_at INTEGER NOT NULL
);

-- ৯. Linked GitHub Repositories
CREATE TABLE github_repos (
    id TEXT PRIMARY KEY NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    active_branch TEXT NOT NULL DEFAULT 'main',
    head_commit_sha TEXT,
    tree_cached_at INTEGER,
    UNIQUE(owner, repo, active_branch)
);

-- ১০. Uploaded Artifacts & Generated Images
CREATE TABLE uploaded_artifacts (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT,
    conversation_id TEXT,
    display_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    local_dir_path TEXT NOT NULL,
    parse_status TEXT NOT NULL,                -- READY | PARTIAL | FAILED
    extracted_markdown_path TEXT,
    page_or_sheet_count INTEGER NOT NULL DEFAULT 0,
    scope TEXT NOT NULL DEFAULT 'SESSION',     -- SESSION | PROJECT
    created_at INTEGER NOT NULL,
    expires_at INTEGER
);

CREATE TABLE generated_images (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL,
    project_id TEXT,
    prompt_exact TEXT NOT NULL,
    model_name TEXT,
    local_file_path TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
```

### ১২.২ v2.4.0 থেকে V3-তে Lossless Migration Strategy (`LegacyStoreMigrator.kt`)
অ্যাপ আপডেট হওয়ার পর প্রথম লঞ্চে `LegacyStoreMigrator` স্বয়ংক্রিয়ভাবে চলবে:
1. `SharedPreferences("bds_storage")` এবং `filesDir/engine-store/`-এর SHA-256 হ্যাশ ফাইলগুলো থেকে `bds_settings`, `bds_memories`, `bds_projects`, `bds_project_files`, `bds_skills`, `bds_characters`, এবং `bds_mcp_servers` পড়া হবে।
2. `bds_projects` ও `bds_project_files`-এর প্রতিটি প্রজেক্টের জন্য `filesDir/workspaces/<projectId>/tree/` তৈরি করে ভেতরের ফাইলগুলো আসল ফাইল হিসেবে ডিস্কে লেখা হবে এবং `projects` ও `project_files` টেবিলে ইনসার্ট করা হবে।
3. `bds_memories`-এর প্রতিটি এন্ট্রি `memories` টেবিলে (`scope = 'GLOBAL'`) স্থানান্তরিত হবে।
4. যদি পুরোনো লোকাল PRoot স্যান্ডবক্সের ওয়ার্কস্পেসে (`filesDir/sandbox/rootfs/root/workspace/`) ব্যবহারকারীর তৈরি কোনো ফাইল থাকে, তবে সেগুলো মুছে ফেলার আগে স্বয়ংক্রিয়ভাবে **`"Legacy Linux Sandbox Backup"`** নামের একটি প্রজেক্ট ওয়ার্কস্পেসে (`filesDir/workspaces/legacy-sandbox/tree/`) নিরাপদে কপি করে রাখা হবে—যাতে ব্যবহারকারীর পুরোনো একটি ফাইলও না হারায়!
5. `githubToken` ও MCP `apiKey` থাকলে সেগুলো `EncryptedCredentialVault`-এ সরিয়ে প্লেইনটেক্সট কপি মুছে ফেলা হবে।
6. মাইগ্রেশন সফলভাবে যাচাই হওয়ার পর `v3_migration_completed = true` ফ্ল্যাগ সেট হবে।

### ১২.৩ Revision R1 — Schema Errata ও সংশোধিত (Normative) Schema

> **§১২.১-এর স্ট্যাটাস:** মূল Draft (১০টি টেবিল) **ঐতিহাসিক রেফারেন্স**। §১২.৩ ও §১২.৪ **নরমেটিভ** — বিরোধে ১২.৩ প্রাধান্য পাবে। Phase 2 (Storage Foundation)-এ Room Entity এই DDL থেকে।

#### ১২.৩.১ চিহ্নিত অসংগতি (Errata) [VF — Spec-এর নিজস্ব পাঠ থেকে]

| # | অসংগতি | সংশোধন |
|---|---|---|
| E1 | `memories.importance` Default `'called'`, অথচ §৯.১ বলে `always \| contextual` | একক Enum `ALWAYS \| CONTEXTUAL`; Kotlin Enum + `CHECK` |
| E2 | §৯.১ ফিল্ড `key`/`content`; Schema `mem_key`/`mem_value` | স্থায়ী নাম: `mem_key`, `mem_value`; §৯.১-এর ব্যাখ্যা সংশ্লিষ্ট |
| E3 | `projects.default_mode` (`TEXT\|CODE\|SEARCH`) বনাম `conversations.modality` (`chat\|webdev\|search\|image`) — দুটি ভিন্ন Enum | একক `Modality = TEXT \| CODE \| SEARCH \| IMAGE`; Adapter-সীমানায় ম্যাপ (`chat→TEXT`, `webdev→CODE`); `projects.default_modality` Image বাদ (CHECK) |
| E4 | `projects.github_repo_id` ও `active_task_checkpoint_id`-এর FK নেই; পরেরটি `task_checkpoints.project_id`-র সাথে বৃত্তাকার | `project_github_links` টেবিল; `active_task_checkpoint_id` **বাদ** (Query দিয়ে নির্ণয়) |
| E5 | `github_repos UNIQUE(owner,repo,active_branch)` — Branch-ভেদে ডুপ্লিকেট Repo-সারি | Repo-স্তর `UNIQUE(owner_lc,repo_lc)`; Branch/Head পৃথক Link-টেবিলে |
| E6 | `project_files_fts` Standalone FTS4 — `project_files` Update/Delete-এ **Stale** সারি; `project_id` ইনডেক্সড কলাম হিসেবে অপচয় | External-Content FTS4 (`@Fts4(contentEntity=…)`), `notindexed=project_id` |
| E7 | `sandbox_command_logs`, `github_tree_entries` টেবিল পাঠে উল্লিখিত, Schema-য় অনুপস্থিত | নতুন টেবিল সংজ্ঞায়িত |
| E8 | `sandbox_snapshots.manifest_json` (JSON-ব্লব) ⇒ Referential Integrity ও Hash-Index নেই; `conversation_id` FK নেই | `snapshot_files` Join টেবিল; FK |
| E9 | কোনো ফাইল **Version** টেবিল নেই (শুধু `project_files` একক সারি) — "প্রতিটি Version সংরক্ষণ" অসম্ভব | `file_versions` + Content-Addressed `blobs` |
| E10 | `uploaded_artifacts`/`generated_images`-এ FK নেই; Lifecycle নেই | FK + Lifecycle (১২.৪) |
| E11 | `conversations.id` = Arena evaluation ID (বহিরাগত ID) একমাত্র PK ⇒ Account/Import সংঘর্ষ ঝুঁকি | `id` অভ্যন্তরীণ UUID; `arena_conversation_id` UNIQUE |
| E12 | Tool-Call/Idempotency/Audit টেবিল নেই; `conversation_turns.role` এ `TOOL_RESULT` মিশ্রিত | `tool_calls`, `audit_log` |
| E13 | Memory Isolation শুধু FK; `UNIQUE` অনুপস্থিত, `GLOBAL` সারিতে `project_id NULL` বাধ্যতা নেই | `CHECK` + `scope_key` UNIQUE |

#### ১২.৩.২ সংশোধিত DDL (পরিবর্তিত/নতুন টেবিল; অপরিবর্তিত ক্ষেত্র মূল Draft অনুযায়ী)

```sql
PRAGMA foreign_keys = ON;   -- Room: FK Enforcement; Migration-পর `PRAGMA foreign_key_check` বাধ্যতামূলক

CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,                 -- UUIDv7; ডিভাইস-নিরপেক্ষ (Backup/Restore-এ অপরিবর্তিত)
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', custom_instructions TEXT NOT NULL DEFAULT '',
  default_modality TEXT NOT NULL DEFAULT 'CODE' CHECK (default_modality IN ('TEXT','CODE','SEARCH')),
  workspace_rel_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED','DELETING')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE saf_mirrors (                      -- L2; saf_tree_uri আর projects-এ নয়
  project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tree_uri TEXT NOT NULL, mirror_uuid TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ATTACHED','DETACHED','MISSING')),
  last_reconciled_at INTEGER
);
CREATE TABLE mirror_state (                     -- Three-Way Base
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL, last_synced_sha256 TEXT NOT NULL, last_synced_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, relative_path)
);

CREATE TABLE blobs (                            -- Content-Addressed Store (ফাইলে: blobs/ab/<sha256>)
  sha256 TEXT PRIMARY KEY NOT NULL, size_bytes INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE file_versions (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL, version INTEGER NOT NULL,
  blob_sha256 TEXT REFERENCES blobs(sha256),    -- NULL = Tombstone (Delete) অথবা Content-not-captured
  content_state TEXT NOT NULL CHECK (content_state IN ('FULL','TOMBSTONE','NOT_CAPTURED')),
  size_bytes INTEGER, is_binary INTEGER NOT NULL DEFAULT 0, mime_type TEXT,
  parent_version_id TEXT REFERENCES file_versions(id),
  source_tier TEXT NOT NULL CHECK (source_tier IN ('A_STREAM','B_DOM','C_ATTESTED','D_USER_IMPORT','LOCAL_USER_EDIT','EXTERNAL_APP_EDIT','GITHUB_PULL')),
  sync_event_id TEXT REFERENCES sync_events(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, relative_path, version)
);
CREATE INDEX ix_fv_blob ON file_versions(blob_sha256);              -- Hash Index
CREATE TABLE project_files (                    -- Head Pointer (সর্বশেষ Verified Version)
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  head_version_id TEXT NOT NULL REFERENCES file_versions(id),
  sync_status TEXT NOT NULL DEFAULT 'SYNCED' CHECK (sync_status IN
    ('SYNCED','LOCAL_MODIFIED','SANDBOX_UNVERIFIED','CONFLICT','CONTENT_NOT_CAPTURED')),
  last_modified_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, relative_path)
);
-- 'SYNCED' কেবল তখনই যখন Head Version Verified (Tier C/ User-import/ Local) — ৬.৫

CREATE TABLE sync_events (                      -- ৬.৫-এর সব Metadata
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  turn_id TEXT REFERENCES conversation_turns(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  source_tier TEXT NOT NULL, operation TEXT NOT NULL CHECK (operation IN
    ('CREATE','EDIT','DELETE','RENAME','BASH_MUTATION','BULK_IMPORT')),
  relative_path TEXT NOT NULL, base_sha256 TEXT, new_sha256 TEXT, attested_sha256 TEXT,
  size_bytes INTEGER, is_binary INTEGER NOT NULL DEFAULT 0, content_complete INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('OBSERVED','CANDIDATE','VERIFIED','COMMITTED','PARTIAL','UNVERIFIED','CONFLICT','REJECTED','DUPLICATE')),
  status_reason TEXT, evidence_json TEXT,
  created_at INTEGER NOT NULL, verified_at INTEGER, committed_at INTEGER
);
CREATE INDEX ix_se_proj_status ON sync_events(project_id, status);

CREATE TABLE snapshots (                        -- আগের sandbox_snapshots
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  turn_id TEXT REFERENCES conversation_turns(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('TURN','CHECKPOINT','MANUAL','PRE_MIGRATION')),
  verified INTEGER NOT NULL DEFAULT 0, summary TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE TABLE snapshot_files (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL, version_id TEXT NOT NULL REFERENCES file_versions(id),
  PRIMARY KEY (snapshot_id, relative_path)
);

CREATE TABLE memories (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('GLOBAL','PROJECT')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,                      -- 'GLOBAL' অথবা projectId
  mem_key TEXT NOT NULL, mem_value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'fact' CHECK (category IN ('preference','fact','instruction','code_convention')),
  importance TEXT NOT NULL DEFAULT 'CONTEXTUAL' CHECK (importance IN ('ALWAYS','CONTEXTUAL')),
  source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  source_modality TEXT, user_verified INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  CHECK ((scope='GLOBAL' AND project_id IS NULL AND scope_key='GLOBAL')
      OR (scope='PROJECT' AND project_id IS NOT NULL AND scope_key=project_id)),
  UNIQUE (scope_key, mem_key)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY NOT NULL,                 -- অভ্যন্তরীণ UUID
  arena_conversation_id TEXT UNIQUE,            -- Arena /c/{id}
  title TEXT NOT NULL DEFAULT '',
  modality TEXT NOT NULL CHECK (modality IN ('TEXT','CODE','SEARCH','IMAGE')),
  model_id TEXT, project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  turn_count INTEGER NOT NULL DEFAULT 0, last_active_at INTEGER NOT NULL
);
CREATE TABLE conversation_turns ( /* মূল Draft অনুযায়ী; role ∈ USER|ASSISTANT; TOOL_RESULT সরানো → tool_calls */
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL, role TEXT NOT NULL CHECK (role IN ('USER','ASSISTANT')),
  raw_content TEXT NOT NULL, original_user_prompt TEXT, finish_reason TEXT,
  stream_complete INTEGER NOT NULL DEFAULT 0,   -- Interrupted Stream চিহ্নিত
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  UNIQUE (conversation_id, turn_index)
);
CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY NOT NULL,
  turn_id TEXT NOT NULL REFERENCES conversation_turns(id) ON DELETE CASCADE,
  call_index INTEGER NOT NULL, tool_name TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('OFFICIAL_OBSERVED','APH_NATIVE')),
  args_json TEXT, status TEXT NOT NULL CHECK (status IN ('PARSED','INVALID','AUTHORIZED','DENIED','EXECUTED','FAILED','CANCELLED')),
  validation_error TEXT, idempotency_key TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE sandbox_command_logs (
  id TEXT PRIMARY KEY NOT NULL,
  tool_call_id TEXT NOT NULL REFERENCES tool_calls(id) ON DELETE CASCADE,
  command TEXT NOT NULL, exit_code INTEGER, output_blob_sha256 TEXT REFERENCES blobs(sha256),
  output_truncated INTEGER NOT NULL DEFAULT 0, attested INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE task_checkpoints (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('PLANNING','EXECUTING','SYNCING','VERIFYING','COMMITTING','PAUSED','COMPLETED','FAILED','CANCELLED')),
  last_verified_snapshot_id TEXT REFERENCES snapshots(id) ON DELETE SET NULL,
  plan_markdown TEXT NOT NULL DEFAULT '', progress_markdown TEXT NOT NULL DEFAULT '',
  last_verified_step INTEGER NOT NULL DEFAULT 0, pending_tool_call_id TEXT REFERENCES tool_calls(id) ON DELETE SET NULL,
  model_id TEXT, last_error TEXT, updated_at INTEGER NOT NULL
);

CREATE TABLE github_repos (id TEXT PRIMARY KEY NOT NULL, owner_lc TEXT NOT NULL, repo_lc TEXT NOT NULL,
  default_branch TEXT NOT NULL, UNIQUE (owner_lc, repo_lc));
CREATE TABLE project_github_links (
  project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES github_repos(id), base_branch TEXT NOT NULL, agent_branch TEXT,
  expected_head_sha TEXT, last_pushed_commit_sha TEXT, tree_complete INTEGER NOT NULL DEFAULT 0,
  tree_etag TEXT, tree_cached_at INTEGER, auth_state TEXT NOT NULL DEFAULT 'OK' CHECK (auth_state IN ('OK','NEEDS_AUTH'))
);
CREATE TABLE github_tree_entries (
  repo_id TEXT NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE, commit_sha TEXT NOT NULL,
  path TEXT NOT NULL, mode TEXT NOT NULL, type TEXT NOT NULL, git_sha TEXT NOT NULL, size_bytes INTEGER,
  PRIMARY KEY (repo_id, commit_sha, path)
);                                               -- শুধু বর্তমান Head-এর সারি রাখা; পুরোনো commit_sha Purge

CREATE TABLE uploaded_artifacts (  /* মূল Draft + */
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  -- display_name, mime_type, size_bytes, sha256, local_dir_path, extracted_markdown_path … (মূল Draft)
  parse_status TEXT NOT NULL CHECK (parse_status IN ('PENDING','READY','PARTIAL','FAILED','ENCRYPTED')),
  parser_id TEXT, parser_version TEXT, fidelity_report_json TEXT,
  scope TEXT NOT NULL DEFAULT 'SESSION' CHECK (scope IN ('SESSION','PROJECT')),
  created_at INTEGER NOT NULL, expires_at INTEGER
);
CREATE INDEX ix_ua_sha ON uploaded_artifacts(sha256); CREATE INDEX ix_ua_exp ON uploaded_artifacts(expires_at);
CREATE TABLE generated_images ( /* মূল Draft + */
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,   -- ছবি ব্যবহারকারীর সম্পদ; Conversation মুছলে হারাবে না
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  -- prompt_exact, model_name, local_file_path, width, height, created_at …
  sha256 TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, exported_media_uri TEXT
);

CREATE TABLE model_capabilities (
  model_id TEXT NOT NULL, harness_version TEXT NOT NULL, surface TEXT NOT NULL,
  tool_protocol TEXT, tag_fidelity REAL, arg_schema_accuracy REAL, edit_precision REAL,
  multistep_reliability REAL, context_budget_tokens INTEGER, stop_honored INTEGER,
  trust_tier TEXT NOT NULL DEFAULT 'T1' CHECK (trust_tier IN ('T0','T1','T2','T3')),
  measured_at INTEGER, evidence_run_id TEXT, PRIMARY KEY (model_id, harness_version, surface)
);
CREATE TABLE audit_log (                         -- Append-only; Hash-chain
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, capability TEXT NOT NULL,
  caller_origin TEXT, is_main_frame INTEGER, project_id TEXT, conversation_id TEXT,
  args_digest TEXT, decision TEXT NOT NULL CHECK (decision IN ('ALLOW','DENY','CONSENT_GRANTED','CONSENT_DENIED','ERROR')),
  reason TEXT, prev_hash TEXT, row_hash TEXT NOT NULL
);
CREATE TABLE credentials_meta (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL,
  scopes_json TEXT, expires_at INTEGER, created_at INTEGER NOT NULL);   -- Secret নয়; Ciphertext Vault-ফাইলে
```

#### ১২.৩.৩ Full-Text Search (FTS) Consistency [PD / PoF-F1]
- **External-Content FTS4:** `file_text(rowid INTEGER PRIMARY KEY AUTOINCREMENT, project_id, relative_path, version_id UNIQUE, content_text)` + `@Fts4(contentEntity = FileText::class, tokenizer = "unicode61", notIndexed = ["project_id"])`; Room-জেনারেটেড Sync-Trigger Insert/Update/Delete সামলায়। **Head Version বদলালে `file_text` সারি Update; Tombstone/Delete-এ সারি Delete** — Stale সারি নেই। Rebuild কমান্ড (`INSERT INTO fts(fts) VALUES('rebuild')`) Integrity-Repair-এ।
- **শুধু Text, আকার-সীমিত** (প্রাথমিক ≤ ১ MB/ফাইল; Binary/Minified/Generated বাদ — যেমন Repo-র ৩.৩ MB `content.js`)।
- **Tokenizer ঝুঁকি [UA→PoF-F1]:** `unicode61` Letter/Number ক্যাটাগরি টোকেন ধরে; **বাংলার সংযুক্ত চিহ্ন (কার/মাত্রা — Mn/Mc) Separator গণ্য হয়ে শব্দ ভেঙে যেতে পারে**; কোড-Identifier-এ `_`/`.`। প্রস্তাব: `tokenchars` এ বাংলা কম্বাইনিং-রেঞ্জ ও `_` যোগ; Bengali/Code Query-Corpus দিয়ে Recall মাপা। FTS5 Room-এ সরাসরি সমর্থিত নয়/Android SQLite-এ প্রাপ্যতা অনিশ্চিত [UA] — FTS4 রাখা।

#### ১২.৩.৪ Transaction, Crash Recovery ও Filesystem-DB সামঞ্জস্য [PD]
1. **Room `withTransaction`** সব Multi-table পরিবর্তনে (Sync Commit, Project Delete, Restore)।
2. **Filesystem Journal:** `fs_journal(id, op, tmp_path, final_path, expected_sha256, state)` — ফাইল-অপারেশন DB-Transaction-এর **বাইরে** ঘটে ⇒ দুই-ধাপ (Staging লিখে `fsync` → DB Commit → Atomic Rename → Journal Close)। Startup-এ `RecoveryScanner`: `PENDING` Journal ⇒ Hash দেখে Roll-forward/Roll-back; অনাথ Staging/Blob GC (৭ দিন Grace)।
3. **WAL মোড; Durability:** `COMMITTED` মার্কার ও Backup/Restore Swap `synchronous=FULL` স্তরে; পাওয়ার-কাট টেস্ট PoF-F2।
4. **Integrity Checks:** Migration/Restore-পর `PRAGMA integrity_check` ও `foreign_key_check`; Blob Hash নমুনা-যাচাই।
5. **Project Delete:** `status=DELETING` ⇒ Cascade Transaction ⇒ Blob GC ⇒ ফাইল-Tree মোছা (বিপরীত ক্রমে নয়, যাতে Crash-এ অনাথ DB-সারি না থাকে)।

### ১২.৪ Entity Lifecycle (সংক্ষিপ্ত তালিকা)

| Entity | সৃষ্টি | পরিবর্তনযোগ্যতা | Retention/মোছা | Cascade | Backup |
|---|---|---|---|---|---|
| `projects` | ব্যবহারকারী/Import | Mutable; `ARCHIVED→ACTIVE` | ব্যবহারকারী Delete (`DELETING`) | সব Child CASCADE (Conversation: SET NULL) | ✓ |
| `file_versions` / `blobs` | প্রতিটি Verified পরিবর্তন | **Immutable** (Append-only) | প্রতি ফাইল শেষ N (৫০) + Snapshot-রেফারেন্সকৃত; Blob GC | Project CASCADE | ✓ (ঐচ্ছিক—আকার) |
| `project_files` | Head Pointer | Mutable (Head বদল) | ফাইল Delete = Tombstone Version | Project CASCADE | ✓ |
| `sync_events` | প্রতিটি Capture | Status-Machine অনুযায়ী | Verified/Committed ৯০ দিন; Rejected/Duplicate ৭ দিন; Unverified ব্যবহারকারী না মেটানো পর্যন্ত | Project CASCADE | ✗ (Debug) |
| `snapshots`/`snapshot_files` | Turn/Checkpoint/Manual/Pre-migration | Immutable | Turn-Snapshot ৩০ দিন/শেষ N; Manual অনির্দিষ্ট | Project CASCADE | ✓ |
| `memories` | ব্যবহারকারী/অনুমোদিত প্রস্তাব | Mutable | ব্যবহারকারী | Project CASCADE (PROJECT-scope) | ✓ |
| `conversations`/`conversation_turns` | Arena `/c/{id}` শনাক্তকরণে | Turn Append-only | ব্যবহারকারী/৯০-দিন Archive | Turns CASCADE; Project মুছলে `SET NULL` | ঐচ্ছিক |
| `tool_calls`/`sandbox_command_logs` | Turn-এর সাথে | Append-only | ৩০ দিন | Turn CASCADE | ✗ |
| `task_checkpoints` | টাস্ক শুরু | Mutable | Completed ৩০ দিন | Conversation/Project CASCADE | ✓ |
| `github_repos`/`links`/`tree_entries` | Link-এর সময় | Mutable | Tree শুধু Head | Link Project CASCADE | Link ✓, Tree ✗ |
| `uploaded_artifacts` | Upload | Parse-ফল Immutable | `SESSION`: ২৪ ঘণ্টা `WorkManager`; `PROJECT`: Project-জীবন | Project CASCADE (PROJECT) | ঐচ্ছিক |
| `generated_images` | ছবি Capture | Immutable | ব্যবহারকারী | Conversation মুছলে **থাকে** | ঐচ্ছিক |
| `audit_log` | প্রতিটি Capability Call | Append-only | ≥ ৯০ দিন (Rotation) | — | ✗ |
| `model_capabilities` | PoF/Matrix Run | Mutable | পুনর্পরিমাপে প্রতিস্থাপন | — | ✓ |
| `credentials_meta` | Token সংরক্ষণ | Mutable | Token মোছায় | — | ✗ (Secret-সংলগ্ন) |

### ১২.৫ Migration ও Legacy ডেটা — নিরাপত্তা-সংযোজন (§১২.২-এর পরিপূরক) [PD]
1. **Copy-Verify-Delete:** Legacy `EngineStore`/`SharedPreferences` থেকে নতুন Store-এ লিখে (Count + Hash যাচাই) তারপরই পুরোনোকে `*.legacy`-এ সরানো; **অন্তত ২টি রিলিজ/৩০ দিন** পুরোনো কপি রাখা (রোলব্যাক-সক্ষম); `v3_migration_completed` ফ্ল্যাগ কেবল সব যাচাই-পর।
2. **Idempotent ও পুনরায়-চালনাযোগ্য** (Crash-এ মাঝপথ থেকে); প্রতিটি ধাপ `migration_steps` Journal-এ।
3. **Legacy PRoot Workspace (`filesDir/sandbox/rootfs/root/workspace/`):** **Rootfs স্বয়ংক্রিয়ভাবে মোছা নিষিদ্ধ।** ব্যবহারকারীকে "আপনার লোকাল Sandbox ফাইলগুলো Import/Export করুন" Wizard দেখিয়ে নির্ভরযোগ্যভাবে Workspace-এ কপি + Hash-যাচাই; ব্যবহারকারী-নিশ্চিতির পরই Rootfs অপসারণ (ADR-001-এর Migration)।
4. **Credential মাইগ্রেশন:** Plaintext পড়া → `KeystoreCredentialVault`-এ লেখা → **Decrypt-Roundtrip যাচাই** → তারপর Plaintext মোছা; ব্যর্থ হলে Plaintext অক্ষত থাকে ও পরবর্তী লঞ্চে পুনরায় চেষ্টা (Token হারানো যাবে না)। মাইগ্রেশন-পর `SharedPreferences` ফাইল-ব্লক Overwrite (শূন্যায়ন), শুধু `remove()` নয়।
5. **Room Schema Migration:** `exportSchema=true`, প্রতি-সংস্করণ `Migration` + `MigrationTestHelper` টেস্ট; Destructive Fallback **নিষিদ্ধ**।

---

## 13. Security, Privacy ও Data Ownership Architecture

> **মূল সংশোধন:** V3 Draft-এর সিদ্ধান্ত "Token এনক্রিপ্ট করে WebView JS-এ গোপন রাখলেই নিরাপদ" এবং ADR-009-এর Consequence "XSS হলেও কোনো টোকেন ফাঁস হওয়া **অসম্ভব**" **ভুল ও প্রত্যাহৃত**। Token গোপন থাকলেও WebView-এ চলা ক্ষতিকর Script Native Bridge ব্যবহার করে ব্যবহারকারীর Token দিয়েই **অনুমোদনহীন কাজ** (Commit, ফাইল মোছা, Network Fetch) করাতে পারে (Confused-Deputy)। তাই নিরাপত্তা = Encryption **+** Capability-ভিত্তিক Authorization **+** Scope **+** Consent **+** Audit।

### ১৩.১ Threat Model ও Trust Boundary

| Trust অঞ্চল | বিষয়বস্তু | বিশ্বাস |
|---|---|---|
| **Native Kotlin Layer** | Broker, Vault, Engines | Trusted (অ্যাপ-কোড); Rooted ডিভাইস/Runtime Memory Dump সুরক্ষার আওতার বাইরে [KL] |
| **WebView (`arena.ai`)** | Arena-র পেজ + তাদের তৃতীয়-পক্ষ Script (reCAPTCHA, Cloudflare, Analytics) + **মডেলের Output** + Arena Preview-এর ভেতর চলা **মডেল-জেনারেটেড অ্যাপ** + আমাদের Injected `ap-*.js` | **Untrusted** — Injected Script Page-এর Main JS World-এ চলে, তাই Page-Script সেগুলো দেখতে/বদলাতে/নকল করতে পারে |
| **বহিরাগত Content** | Fetch-কৃত ওয়েবপেজ, GitHub ফাইল/Issue/PR-Comment/Actions Log, MCP Tool Description/Result, আপলোডকৃত Document, Arena Model Output | **Untrusted Data** (Prompt-Injection উৎস) |
| **Arena Sandbox** | মডেলের চালানো কমান্ড ও Output | তৃতীয়-পক্ষ পরিবেশ: **কোনো Secret সেখানে যাবে না** |
| **অন্য Android অ্যাপ** | `DocumentsProvider` ক্লায়েন্ট | সীমিত বিশ্বাস (Scope-ভিত্তিক) |

**প্রধান Attack Path:** (১) Arena পেজ/তৃতীয়-পক্ষ Script-এ XSS; (২) Arena Preview-Iframe-এ চলা মডেল-জেনারেটেড অ্যাপ (**`srcdoc`/same-origin হলে Origin-Rule মিলে যেতে পারে**) Bridge কল করে; (৩) মডেল Prompt-Injection-এ Native Tool Tag (`APH`) জারি করে; (৪) ক্ষতিকর MCP Server; (৫) Zip/PDF/Office ফাইলে Parser Exploit; (৬) Backup ফাইল-টেম্পারিং।

### ১৩.২ Credential Storage — `KeystoreCredentialVault` (ADR-009-R1) [PD / Conditional]
- **কোনো `security-crypto` নয়** (Deprecated [VF ২.৫])। প্ল্যাটফর্ম `AndroidKeyStore` + `Cipher("AES/GCM/NoPadding")`।
- **Key:** Non-exportable AES-256, `setBlockModes(GCM)`, `setRandomizedEncryptionRequired(true)`; উপলব্ধ হলে StrongBox (`setIsStrongBoxBacked(true)`, `StrongBoxUnavailableException`-এ TEE-তে Fallback)। User-Authentication-Bound Key ডিফল্টে নয় (Background Task ভাঙবে); **GitHub-Write সক্ষম করার** ধাপে ঐচ্ছিক Biometric/Device-Credential Gate (`BiometricPrompt` + `CryptoObject`)।
- **Ciphertext ফরম্যাট:** `v1 | keyAlias | iv(12B) | ct+tag`; **AAD = credentialId‖kind** (এক Credential-এর Ciphertext অন্যটিতে বসানো প্রতিরোধ); ফাইল `noBackupFilesDir/vault/<id>.bin` (Backup থেকে বাদ)।
- **Failure:** `KeyPermanentlyInvalidatedException`/Key অনুপস্থিত (Clear Data/Restore) ⇒ Vault Reset + পুনঃপ্রবেশ প্রম্পট (Crash নয়); Decrypt-ব্যর্থতা Token-লাইফসাইকেল ঘটনা হিসেবে Audit-এ।
- **Hygiene:** Token কখনো Log/Crash-Report/URL/Prompt/WebView/Backup-এ নয়; Header-Redaction; Token-Entry-স্ক্রিনে `FLAG_SECURE`; Clipboard-এ `EXTRA_IS_SENSITIVE` (Android 13+) ও পেস্ট-পর Clear-সুপারিশ।
- **বিকল্প (Rejected/Alternative):** Tink (Google-রক্ষণাবেক্ষিত; নির্ভরতা ও Keyset-ব্যবস্থাপনা যোগ করে) — Phase 1-এর Spike-এ তুলনা করা যাবে, তবে ডিফল্ট প্ল্যাটফর্ম API (ছোট, Dependency-মুক্ত)।
- **সীমা [KL]:** Keystore সুরক্ষা Root/Runtime-Memory আক্রমণ ঠেকায় না; Token HTTP Call-এর সময় ক্ষণিক Memory-তে থাকে।

### ১৩.৩ Native Bridge — ADR-013 (`addWebMessageListener` + `CapabilityBroker`)
1. **`WebViewCompat.addWebMessageListener("arenaPilotBridge", setOf("https://arena.ai","https://www.arena.ai"), listener)`** — Official Recommended [VF ২.৭]। Listener প্রতি Message-এ `sourceOrigin` ও `isMainFrame` পায়; **`isMainFrame == true` ও `sourceOrigin` সঠিক না হলে সম্পূর্ণ প্রত্যাখ্যান**। (`srcdoc`/`about:blank` Iframe অভিভাবকের Origin উত্তরাধিকার পায় ⇒ Origin-মিল একা যথেষ্ট নয়; `isMainFrame` বাধ্যতামূলক — **PoF-W2:** বাস্তব Arena Preview Iframe-এর Origin/Sandbox Attribute যাচাই।)
2. **`addJavascriptInterface` পর্যায়ক্রমে বিলুপ্ত।** বর্তমান `AndroidBridge` [VF `MainActivity.kt:687`] সব Frame-এ উন্মুক্ত। **Phase 1 Deliverable: Bridge Method Inventory** — প্রতিটি Method একটি Capability-ক্লাসে (R0 নিরীহ / R1 পাঠ / W1 লোকাল-লেখা / N1 নেটওয়ার্ক / G1 GitHub-লেখা / C0 Credential) বর্গীকৃত; W1/N1/G1/C0 Legacy-Bridge থেকে **সরানো**; এক রিলিজ Dual-Stack (Legacy শুধু R0/R1) তারপর অপসারণ।
3. **Feature-সাপোর্ট না থাকলে** (`WebViewFeature.isFeatureSupported(WEB_MESSAGE_LISTENER)` মিথ্যা; WebView < ৮২): **Privileged Capability অক্ষম (Read-only Degraded Mode)** — `addJavascriptInterface`-এ নীরব Fallback **নিষিদ্ধ** (এই Fallback-ই বাস্তব অ্যাপে Iframe-এ Bridge ফাঁসের কারণ হয়েছে — Secondary Evidence)।
4. **Page-Script Bridge-Message নকল করতে পারে** (Nonce Page-JS-এ দৃশ্যমান) ⇒ Nonce নিরাপত্তা-নিয়ন্ত্রণ নয়, শুধু Replay-হ্রাস। **নিরাপত্তা আসে Native-এ Consent + Scope থেকে।**
5. **Blob-Endpoint (`/__sd/blob/<token>`):** ১২৮-বিট Single-use Token, TTL, নির্দিষ্ট Request-বাউন্ড; Same-origin Page-Script পড়তে পারে ধরে নিয়ে **Bearer-Secret** হিসেবে ট্রিট; বিস্তৃত CORS নয়।
6. **WebView Hardening:** `setAllowFileAccess(false)`, `setAllowContentAccess(false)`, `setAllowFileAccessFromFileURLs/UniversalAccessFromFileURLs(false)`, Release-এ Remote Debugging বন্ধ, Mixed Content ব্লক, Safe Browsing, `shouldOverrideUrlLoading` Allowlist (`intent:`/`file:`/`content:`/`javascript:` ব্লক), Popup (OAuth) আলাদা নিয়ন্ত্রিত Window (Bridge নেই)।
7. **Native Consent UI** WebView-DOM নয় — Activity-স্তরের Dialog; Tapjacking-রোধে `filterTouchesWhenObscured`; Origin/Action/Scope/Diff দৃশ্যমান।

### ১৩.৪ Native Capability Matrix — Authorization, Validation, Scope, Audit [PD]

> প্রতিটি Capability **Broker-এ** কার্যকর (Prompt-এ নয়)। ডিফল্ট: Deny। সব Call `audit_log`-এ (Allow/Deny/Consent)।

| Capability | Authorization | Input Validation | Operation Scope | Audit |
|---|---|---|---|---|
| `workspace.read` | Project-প্রতি একবার "মডেলকে পড়তে দিন" (Revocable); `local_file_read` ডিফল্ট Ask-each-time | Path Normalize/`..`/Symlink-Escape ব্লক; Range/Size Cap | শুধু Active Project Tree; অন্য Project নয় | path, bytes, caller |
| `sync.ingest` (লেখা) | Verified-Pipeline ছাড়া নয়; ব্যবহারকারী Opt-in "Auto-sync" | Path/Size/Encoding/Hash (৬.৫); Rate-limit | Active Project; Staging→Commit | syncId, hash, tier |
| `workspace.delete` | Tombstone শুধু; > N ফাইল বা Dir ⇒ Consent-each | Path Scope | Active Project; Version-সংরক্ষিত (Undo) | paths |
| `saf.*` / `file.pick` / `backup.*` / `settings.*` / `credentials.*` | **শুধু Native UI-জাত Gesture**; Page থেকে Request এলে Native Confirm-Dialog (Page এগুলো সরাসরি Trigger করতে পারে না) | URI Scheme/Authority যাচাই; Credential **কখনো Page-কে ফেরত নয়** | ব্যবহারকারী-নির্বাচিত Tree/File | action, uri-digest |
| `net.fetch` | নতুন Domain-এ প্রথমবার Consent; Project Egress-Allowlist | `https` (HTTP Opt-in); URL ≤ N; `NetworkGuard` SSRF (DNS একবার Resolve→IP-pin, **প্রতি Redirect-এ পুনঃযাচাই**, IPv4-mapped IPv6/`0.0.0.0/8`/`100.64.0.0/10`/Metadata-IP/`localhost` সহ); Cookie/Credential অগ্রেষিত; Content-Type Allowlist; Size/Time Cap | Domain-scoped | url-digest, bytes |
| `mcp.call` | Server-প্রতি Enable + Tool-প্রতি Allowlist; "Dangerous" Tool ⇒ Consent-each | Schema-যাচাই; Tool-Description/Result Untrusted; Key Native-এ সংযুক্ত | Server-scoped | server, tool |
| `github.read` | Link-করা Repo-তে (Token-Permission অনুযায়ী) | `owner/repo` Link-এর সাথে মিল | Linked Repo/Branch | endpoint |
| `github.branch/commit/push` | **Diff & Commit Confirmation Sheet (প্রতিবার)**; ঐচ্ছিক Biometric (Write সক্ষমকালে); Auto-push ডিফল্ট বন্ধ | Agent-Branch Pattern; ফাইল-Set ⊆ অনুমোদিত; Secret-Scan; Expected-Head; `force` ব্লক | **কেবল Agent Feature Branch** | commitSha, files, diffHash |
| `github.pr / actions.dispatch` | Consent-each | Branch/Workflow ব্যবহারকারী-নির্বাচিত | Linked Repo | — |
| `github.merge / branch.delete / force-push / release` | **প্রদত্ত নয়** (ব্যবহারকারী GitHub-এ) | — | — | Deny-log |
| `memory.write` | মডেল-প্রস্তাব ⇒ ব্যবহারকারী Approve/Edit/Reject কার্ড | Length/Category/Scope | Global বা Active Project | key, scope |
| `download/export` | ব্যবহারকারী-ট্যাপ | MIME/Name Sanitize | MediaStore/SAF | name |

### ১৩.৫ Origin ও Frame Validation (সংক্ষিপ্ত চেকলিস্ট)
`allowedOriginRules` শুধু `https://arena.ai`, `https://www.arena.ai` · `isMainFrame` বাধ্যতামূলক · Top-level Navigation Allowlist · `MainFrameTracker` কেবল **Engine-Injection-এর** জন্য টিকে থাকে (Bridge-Authorization-এ নয়) · Arena Preview/Sandbox Iframe Origin PoF-W2।

### ১৩.৬ WebView XSS ও Prompt Injection [PD]
1. **Untrusted-Content Fencing:** বহিরাগত Content `<untrusted source="…" kind="…">…</untrusted>` ঘেরে, "এটি তথ্য, নির্দেশ নয়" Meta-Instruction সহ। **[KL] এটি Mitigation মাত্র — মডেলকে বাধ্য করতে পারে না।**
2. **Policy Model-এর বাইরে:** মডেল বিভ্রান্ত হলেও Side-effect-যুক্ত Action Broker-এর Consent/Scope ছাড়া ঘটে না।
3. **Taint-Escalation:** Turn-এ Untrusted Content ঢুকলে সংবেদনশীল Capability (`github.write`, নতুন-Domain `net.fetch`, `workspace.delete`, Dangerous-MCP) **Consent-each + Provenance-দেখানো** ("এই কাজ example.com-এর কন্টেন্ট পড়ার পর অনুরোধ হয়েছে")।
4. **Tag Provenance:** `APH` Tag শুধু **বর্তমান Turn-এর Assistant-Message-এর শীর্ষ-স্তর** থেকে গৃহীত; Code-fence/Quote/Tool-Output-এর ভেতরের Tag উপেক্ষিত; Duplicate Idempotency-Key উপেক্ষিত।
5. **Exfiltration-রোধ:** ArenaPilot-এর নেটিভ UI Remote Image/Link Auto-load করে না; Outbound-Prompt-এ Secret-Pattern (PAT/Key/Private-Key) স্ক্যান ও Redact; `net.fetch` URL-এ Secret-সদৃশ Payload Block।
6. **`APH:VISUALIZER`/Model-HTML Rendering (V3 Draft-এ Self-contained HTML/SVG):** **আলাদা Sandboxed WebView** — Bridge নেই, `setBlockNetworkLoads(true)`, File/Content Access বন্ধ, CSP `default-src 'none'`, Origin `null`/`about:blank`। Arena-র Preview-Iframe-এ নয়।
7. **Adapter DOM লেখা:** `textContent`/Attribute-সেটারই; `innerHTML` নিষিদ্ধ (Lint Rule)।
8. **Secrets কখনো Context-এ নয়:** PAT/API Key মডেলে/Sandbox-এ/Prompt-এ/Tool Arg-এ যাবে না (**Channel ৩-এর Sandbox-`git push` নিষিদ্ধ**)।

### ১৩.৭ Audit Trail
`audit_log` (১২.৩.২): Append-only, Hash-chained (`prev_hash→row_hash`) — Tamper-সনাক্তকরণ (Rooted ডিভাইসে Tamper-প্রতিরোধ নয় [KL])। Settings→"Activity Log" এ ব্যবহারকারী দেখতে/Export করতে পারবেন (Secret নয়, Digest-সহ)। Rotation ≥ ৯০ দিন। "Panic Wipe": সব Credential + Audit + Consent-Grant মোছা।

### ১৩.৮ Privacy ও Data Ownership
- কোনো Telemetry নেই; Prompt Arena-য় যায় (ব্যবহারকারীর বেছে নেওয়া পরিষেবা) — স্পষ্ট জানানো। Document Parsing লোকাল, কিন্তু নিষ্কাশিত টেক্সট Prompt-এ গেলে Arena-য় যায়: প্রতি-ফাইল Consent (`Current Conversation Only` / `Saved in Project`)।
- Data Ownership: ব্যবহারকারীর ফাইল L2/L3/GitHub-এ ব্যবহারকারীর নিয়ন্ত্রণে (৮.৫); Export সবসময় Open-format (Plain Tree + `.apbackup` ডকুমেন্টেড স্পেক)।
- **`android:allowBackup="false"` বহাল**, কিন্তু সঠিক যুক্তিসহ: Keystore Key ডিভাইস-বাউন্ড তাই Cloud-Restore-কৃত Ciphertext অপাঠ্য; অনিয়ন্ত্রিত Credential/Session-ডেটা Backup-এ যাওয়া এড়ানো; ২৫ MB সীমা [RF]। (Draft-এর "Keystore মেটাডেটা বাইরে যাবে" যুক্তি অসম্পূর্ণ ছিল।) পোর্টেবল সমাধান ৮.৯।

### ১৩.১০ V3 Draft থেকে বহাল নিয়ম (অপরিবর্তিত)
- **SSRF Filter (`NetworkGuard.FilteringDns`):** `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7` ব্লক — R1 সংযোজন: `0.0.0.0/8`, `100.64.0.0/10` (CGNAT), IPv4-mapped IPv6, Cloud-Metadata IP, DNS-Pinning ও প্রতি-Redirect পুনঃযাচাই (১৩.৪ `net.fetch`)।
- **Explicit Consent:** ব্যবহারকারী নিজে ফাইল-পিকার/SAF দিয়ে যা নির্বাচন করেননি, অ্যাপ সেই ফাইলে হাত দেবে না; GitHub Push/Branch-Delete/PR-এর আগে Diff & Commit Confirmation Sheet (R1: Branch-Delete ও Merge Agent-এর ক্ষমতার বাইরে, ৭.৫.৫)।
- **CAPTCHA/Login বাইপাস নয়; কোনো Telemetry নয়।**

### ১৩.৯ নিরাপত্তা যাচাই (PoF ও টেস্ট)
`W1` Bridge Inventory ও Legacy-Dual-Stack Compatibility · `W2` Arena Preview-Iframe Origin/Frame প্রমাণ (Malicious-Iframe হার্নেস) · `W3` `addWebMessageListener` Feature-Matrix (WebView ৮২+, Emulator/ডিভাইস) · `W4` Prompt-Injection Corpus (Web/GitHub/MCP/Doc) বনাম Broker — **লক্ষ্য: Consent ছাড়া কোনো সংবেদনশীল Side-effect শূন্য** · `W5` SSRF Test-Corpus (Redirect/DNS-Rebind/IPv6) · `W6` Visualizer Sandbox Escape Tests · `K1` Keystore Vault: Key-Invalidation, Clear Data, StrongBox-Fallback · `K2` Credential Migration Crash-Test · `K3` Log/Crash-Report Secret-Leak Scan।

---

---

## 14. Error Handling, Process Recovery ও Long-Running Task Management

### ১৪.১ দীর্ঘমেয়াদি কাজের স্টেট মেশিন (`TaskCheckpointStateMachine`)

```
[IDLE] ---> [PLANNING] ---> [EXECUTING_IN_OFFICIAL_SANDBOX] <---> [SYNCING_TO_ANDROID_STORAGE]
                                       |                                      |
          +----------------------------+----------------------------+         |
          v                            v                            v         v
 [PAUSED_RATE_LIMIT]       [RECOVERING_RENDERER_KILL]       [VERIFYING_BUILD_AND_TESTS]
          |                            |                                      |
          +------------+---------------+                                      v
                       |                                           [COMMITTING_TO_GITHUB]
                       +-------------------> [EXECUTING...]                   |
                                                                              v
                                                                         [COMPLETED]
```

### ১৪.২ WebView Renderer Kill (`reason=12/13`) ও Stream Drop Recovery
অডিটে দেখা গেছে যে CI এবং কম RAM-যুক্ত ফোনে Android মাঝে মাঝে WebView-এর স্যান্ডবক্সড রেন্ডারার প্রসেস (`onRenderProcessGone`) বন্ধ করে দেয়। V3-তে এর স্থায়ী সমাধান:
1. **Zero Critical State in WebView RAM:**
   প্রতিটি স্ট্রিম চাঙ্ক (`a0:`, টুল কল, ফাইল আর্টিফ্যাক্ট) আসার সাথে সাথে ডিবাউন্স করে নেটিভ `conversation_turns` ও `task_checkpoints` টেবিলে সংরক্ষিত হবে।
2. **Seamless Session & Task Restoration:**
   রেন্ডারার ক্র্যাশ করলে `RendererCrashGuard` পেজটি পুনরায় `/c/{id}`-এ লোড করবে, `conversations` টেবিল থেকে সঠিক মোড (`CODE`/`TEXT`/`SEARCH`/`IMAGE`) ও সংযুক্ত `projectId` লোড করবে এবং যদি কোনো কাজ চলমান থাকে (`state != COMPLETED`), তবে স্ক্রিনের ওপরে **"Resume Task from Step X"** চিপ দেখাবে।
3. **Bounded Auto-Continue & Rate-Limit Backoff:**
   - মডেলের উত্তর যদি আউটপুট টোকেন লিমিটের কারণে মাঝপথে কেটে যায় (`finishReason === "length"` বা অসমাপ্ত কোড ব্লক/টুল ট্যাগ), তবে ইঞ্জিন সর্বোচ্চ ২ বার স্বয়ংক্রিয়ভাবে `"Continue from exact last verified line..."` বার্তা পাঠাবে।
   - HTTP 429 (Rate Limit) বা নেটওয়ার্ক ড্রপ হলে এক্সপোনেনশিয়াল ব্যাকঅফ কাউন্টডাউন টোস্ট দেখিয়ে ব্যবহারকারীকে রিট্রাই করার সুযোগ দেবে।

### ১৪.৩ Revision R1 — Sync/Backup-সংশ্লিষ্ট Crash Recovery ও Interrupted-Stream আচরণ [PD]
1. **Interrupted/Duplicate Stream:** প্রতিটি Stream-Chunk নেটিভে স্থায়ী হলেও `conversation_turns.stream_complete=false` থাকে যতক্ষণ না `ad:{finishReason}` (বা সমতুল্য) দেখা যায়। `false` Turn-এর Tool Call/ফাইল-Content থেকে তৈরি `sync_events` **সর্বোচ্চ `PARTIAL`/`CANDIDATE`** — কখনো `VERIFIED` নয়। Reload/Reconnect-এ একই Event আবার এলে Idempotency-Key-এ `DUPLICATE`।
2. **Renderer Kill (`onRenderProcessGone`) বা App Background:** চলমান `CANDIDATE`/Staging অক্ষত (Native); Resume-এ Turn-শেষ অজানা হলে "Turn অসম্পূর্ণ" চিহ্ন + Tier C Verification প্রস্তাব। **Official Sandbox State Android থেকে পুনরুদ্ধার বা নিয়ন্ত্রণযোগ্য নয়** [KL] — শুধু Android-এ সংরক্ষিত Verified কপি নিরাপদ।
3. **Process Death মাঝপথে Commit:** `fs_journal` (১২.৩.৪) দিয়ে Startup-এ Roll-forward/Roll-back; `COMMITTED` কখনো Hash-যাচাই ছাড়া নয়।
4. **Backup/Restore Interruption:** ৮.৬; Restore Staging থেকে Atomic Swap, তাই অর্ধেক Restore-এ বর্তমান Live ডেটা অক্ষত।
5. **State Machine সম্প্রসারণ:** ১৪.১-এর Diagram-এ `SYNCING_TO_ANDROID_STORAGE`-এর ভেতরে উপ-অবস্থা `CAPTURING → VERIFYING(Tier C) → COMMITTING → DONE | NEEDS_USER(Unverified/Conflict)`; Model Switch/Stop (৫.৪.৭, ৫.৪.১০) `PAUSED_*`-এ রূপান্তর।

---

## 15. UI/UX ও Mobile-First Navigation Structure

1. **একক চ্যাট সারফেস নীতি অক্ষুণ্ণ রাখা:**
   `arena.ai`-এর আসল চ্যাট পেজ ও কমপোজারই থাকবে প্রধান ইন্টারফেস। এর ওপরে কেবল হালকা, টাচ-বান্ধব ও অ্যাক্সেসিবল (৪৮×৪৮ dp মিনিমাম টাচ টার্গেট, বাংলা ও ইংরেজি পূর্ণ সমর্থন, ডার্ক/লাইট থিম সিঙ্ক) নেটিভ কন্ট্রোল বসবে।
2. **Mode-Aware Workspace Bar (কমপোজারের ওপরে হালকা পিল বার):**
   - বর্তমান Direct Mode (`Text`, `Code`, `Search`, `Image`) প্রদর্শন ও ১ ট্যাপে পরিবর্তনের সুবিধা।
   - সক্রিয় Project নাম (যেমন `📁 ArenaPilot-V3 · ⎇ main`) এবং সিঙ্ক স্ট্যাটাস (`✓ Synced 14 files`)।
3. **Code Mode Quick Sheet (Code Mode-এ দৃশ্যমান):**
   - **Tab 1 — Workspace Files:** অফিসিয়াল স্যান্ডবক্স থেকে সিঙ্ক হওয়া সকল ফাইলের ট্রি ও কোড ভিউয়ার।
   - **Tab 2 — Diff & Snapshots:** সর্বশেষ টার্নে কোন ফাইলে কী পরিবর্তন হয়েছে তার রঙিন ডিফ এবং ১ ক্লিকে রোলব্যাক।
   - **Tab 3 — GitHub:** সংযুক্ত রিপোজিটরি, ব্রাঞ্চ সুইচার, Commit & Push, PR তৈরি এবং GitHub Actions CI স্ট্যাটাস।
   - **Tab 4 — Task Plan (`PLAN.md` & `PROGRESS.md`):** এজেন্টের বর্তমান কাজের ধাপ ও অগ্রগতি।
4. **Refined `+` Attach Sheet (মোড-অনুযায়ী প্রাসঙ্গিক অপশন):**
   - **Upload Files (Any Format):** PDF, DOCX, XLSX, PPTX, ZIP, Code, Text।
   - **Upload Images / Camera:** গ্যালারি বা ক্যামেরা থেকে ছবি।
   - **Import Folder (SAF):** ডিভাইসের যেকোনো প্রজেক্ট ফোল্ডার।
   - **Attach Project / Switch Project:** প্রজেক্ট ওয়ার্কস্পেস সংযুক্ত করা।
   - **Connect GitHub Repository (Code Mode):** সরাসরি GitHub রিপোজিটরি যুক্ত করা।
   - *(Image Mode-এ কেবল রেফারেন্স ইমেজ আপলোড ও Prompt Vault দেখানো হবে।)*

---

## 16. Testing Strategy, CI Verification Gates ও Acceptance Criteria

### ১৬.১ চার স্তরের স্বয়ংক্রিয় পরীক্ষা (4-Tier Automated Testing Pyramid)

1. **Tier 1 — Native JVM & Robolectric Unit Tests (`./gradlew testDebugUnitTest`):**
   - `ArenaDatabaseMigrationTest`: v2.4.0-এর `EngineStore` ফাইল ও `SharedPreferences` থেকে Room ডাটাবেস ও `WorkspaceFileSystem`-এ ১০০% ডেটা মাইগ্রেশন যাচাই।
   - `OfficialSandboxSyncEngineTest`: স্ট্রিম থেকে `create_file`, `edit_file`, `delete_file` ইভেন্ট পার্স করে স্থানীয় ফাইল ট্রি আপডেট, স্ন্যাপশট তৈরি ও রোলব্যাক যাচাই।
   - `GitHubAgentEngineTest` (`MockWebServer`): Git Data API (`trees` → `blobs` → `commits` → `refs`) দিয়ে মাল্টি-ফাইল কমিট, ব্রাঞ্চ তৈরি, PR ও রেট-লিমিট হ্যান্ডলিং যাচাই।
   - `FileAnalysisEngineTest`: আসল স্যাম্পল `PDF`, `DOCX`, `XLSX`, `PPTX`, এবং `ZIP` ফাইল পার্স করে Markdown ও টেবিল নিষ্কাশন যাচাই।
   - `MemoryAndProjectIsolationTest`: `Project A`-এর সেশনে `Project B`-এর কোনো মেমরি বা ফাইল কখনোই লিক হয় না তা প্রমাণ।
2. **Tier 2 — Modular JS Adapter Unit Tests (`npm run test:engine`):**
   - ৪টি Direct Mode প্রোফাইল, Image Mode-এ শূন্য প্রম্পট ইনজেকশন, সংশোধিত Office Skill ট্রিগার (যাতে `"document"` বা `"report"` শব্দে মিথ্যা ট্রিগার না হয়), এবং স্ট্রিম আর্টিফ্যাক্ট এক্সট্র্যাক্টরের ইউনিট টেস্ট।
3. **Tier 3 — Offline Chromium Integration Harness (`npm run test:harness:arena`):**
   - মডেলকৃত Arena.ai DOM-এ ৪টি Direct Mode (`/text/direct`, `/code/direct`, `/search/direct`, `/image/direct`), `/c/{id}` রিলোড পুনরুদ্ধার এবং স্যান্ডবক্স ফাইল সিঙ্ক পরীক্ষা।
4. **Tier 4 — Android API 34 Emulator Smoke Gate (`android/ci/emulator-smoke.sh`):**
   - APK ইন্সটল, কোল্ড বুট, সেটিংস শিট ওপেন, প্রজেক্ট তৈরি, ফাইল পার্সিং, স্যান্ডবক্স সিঙ্ক এবং রেন্ডারার কিল রিকভারি যাচাই।

### ১৬.২ প্রধান ফিচারগুলোর Acceptance Criteria (সংক্ষিপ্ত তালিকা)

| ফিচার | গ্রহণযোগ্যতার মাপকাঠি (Verifiable Acceptance Criteria) |
|---|---|
| **Single Official Sandbox** | APK-তে কোনো `libproot.so` বা লোকাল Alpine rootfs থাকবে না; Code Mode-এ ১০০% কোড Arena-এর Official Sandbox-এ চলবে। |
| **Persistent Sandbox Sync** | Official Sandbox-এ মডেল ফাইল তৈরি/এডিট করার সাথে সাথে সেটি Android-এর `filesDir/workspaces/<projectId>/tree/`-তে সেভ হবে; অ্যাপ বন্ধ করে পুনরায় খুললেও বা স্যান্ডবক্স রিসেট হলেও ১ ক্লিকে ফাইলগুলো নতুন স্যান্ডবক্সে হাইড্রেট হবে। |
| **GitHub End-to-End** | ব্যবহারকারী Settings বা Code Sheet থেকে PAT যোগ করে রিপোজিটরি ব্রাউজ, ব্রাঞ্চ তৈরি, মাল্টি-ফাইল পরিবর্তন Diff রিভিউ, অ্যাটমিক Commit & Push এবং PR তৈরি করতে পারবেন। |
| **Multi-Format File Analysis** | ব্যবহারকারী `PDF`, `DOCX`, `XLSX`, `PPTX` বা `ZIP` ফাইল আপলোড করলে নেটিভ পার্সার প্রকৃত টেক্সট/টেবিল নিষ্কাশন করে প্রিভিউ দেখাবে এবং মডেল সেই তথ্যের ভিত্তিতে সঠিক উত্তর দেবে। |
| **Image Mode Purity** | `/image/direct`-এ পাঠানো কোনো মেসেজে ১ বাইটও অতিরিক্ত সিস্টেম প্রম্পট বা মেমরি যুক্ত হবে না (`userMessage.content === rawUserInput`) এবং জেনারেটেড ছবি স্বয়ংক্রিয়ভাবে নেটিভ গ্যালারিতে সেভ হবে। |

### ১৬.৩ Revision R1 — "সম্পন্ন" এর সংজ্ঞা: কেবল Unit Test যথেষ্ট নয়

একটি Feature **Done** তখনই যখন নিচের টেবিল অনুযায়ী প্রযোজ্য **সব** Evidence-স্তর থাকে এবং Evidence **সংরক্ষিত ও পুনরুৎপাদনযোগ্য** (তারিখ, কমিট SHA, ডিভাইস/API, Arena-Session-লিংক বা Repo, লগ/স্ক্রিনশট/Hash)। Mock/Fixture-ভিত্তিক Harness কোনো বাস্তব Arena/GitHub/Device Evidence-এর বিকল্প নয় (Mock Arena DOM-এ সবুজ ≠ বাস্তব Arena-য় কাজ করে)।

| Feature | Unit/JVM | Instrumented (বাস্তব Android Device/Emulator) | **বাস্তব Arena Session** | **বাস্তব GitHub Repo** | Security Test |
|---|---|---|---|---|---|
| Official Sandbox Sync | ✓ (Parser/State-machine/Hash) | ✓ (Atomic Commit, Process-kill) | **✓ বাধ্যতামূলক** (PoF-S1…S12 ফলাফল সংযুক্ত) | — | ✓ (Path-scope, Poisoned-manifest) |
| Storage/Backup/Restore | ✓ | **✓** (Uninstall/Clear Data/Update/Cross-device, ≥ ২ API-স্তর) | — | — | ✓ (Tamper, Wrong-passphrase) |
| Native Bridge | ✓ | ✓ | **✓** (Preview-Iframe, Real Origin) | — | **✓** (Malicious-Iframe, Fuzz) |
| GitHub Agent | ✓ (MockWebServer) | ✓ | — | **✓** (Scratch Repo: Commit/Race/PR/Actions) | ✓ (Main-protect, Secret-scan) |
| File Analysis | ✓ (Corpus) | **✓** (Low-RAM Device, বড় PDF) | — | — | ✓ (Zip-bomb, Malformed) |
| Model Compatibility | ✓ (Validator) | — | **✓** (Repository Task Suite, ৫.৪.১১) | ✓ (PR-প্রস্তুতি Task) | ✓ (Injection) |
| Performance Claim | — | **✓** (Baseline+After, নির্ধারিত ডিভাইস) | — | — | — |

- **Evidence Ledger:** প্রতিটি Phase-এর শেষে Ledger (Feature → Evidence লিংক/Hash)। Ledger-এর অনুপস্থিতিতে Phase Acceptance **অসম্পূর্ণ**। (Ledger-এর স্থান/ফরম্যাট Phase 0 Deliverable; এই Revision-এ কোনো নতুন ফাইল তৈরি হয়নি।)
- **Arena-নির্ভর পরীক্ষা Flaky/Account-নির্ভর:** Session-লিংক, তারিখ, মডেল-নাম রেকর্ড; Arena UI পরিবর্তন শনাক্তে **Canary Test** (Selector/Stream-Format Drift) নিয়মিত।

---

## 17. Performance, RAM, Battery ও Storage Requirements

> **সংশোধন:** V3 Draft-এর "APK ৩০–৪০ MB কমবে", "WebView RAM ৫০%+ কমবে", "File Search < ৫০ms", "UI Freeze শূন্য" — এগুলোর পক্ষে **কোনো বাস্তব Benchmark নেই**। এগুলো এখন **Unverified Hypothesis (H1–H4)**; PoF-এর আগে "নিশ্চিত ফলাফল" হিসেবে উল্লেখ নিষিদ্ধ। "শূন্য" Testable নয়, তাই পরিমাপযোগ্য মেট্রিকে রূপান্তরিত। **নিচের সংখ্যাগুলো Acceptance Threshold হিসেবে "প্রস্তাবিত" — Baseline পরিমাপের পর সংশোধিত হবে; কৃত্রিম Benchmark যোগ করা হয়নি।**

### ১৭.১ সাধারণ পরীক্ষা-নীতি
- **Test Devices (Phase 0-এ প্রকৃত মডেল/OS-বিল্ড রেকর্ড করতে হবে; এখানে কোনো ডিভাইস অনুমান করা হয়নি):** (ক) Low-end — API 26–29, ≤ ৩ GB RAM; (খ) Mid — API 33/34, ৪–৬ GB; (গ) High — API ≥ 35 (SDK Extension ≥ 13 যাচাইসহ); (ঘ) CI Emulator API 34 (শুধু Smoke, Performance-সিদ্ধান্তে নয়)।
- **Build:** Release (R8), Debuggable নয়, একই Signing/Config; Baseline = `v2.4.0` (`main` @ `80b9f0a`); After = প্রার্থী Build। **কমপক্ষে ১০ রান**, Median ও IQR/p95; Warm-up বাদ; একই Network/Battery অবস্থা; থার্মাল-কুলডাউন।
- **Result Collection:** স্ক্রিপ্টেড (`adb`, Macrobenchmark, Perfetto, `dumpsys`) ও Raw Data সংরক্ষিত; **Claim = শুধু পরিমাপকৃত সংখ্যা + ডিভাইস + তারিখ + কমিট**।

### ১৭.২ Requirement-ভিত্তিক পরিমাপ-পরিকল্পনা

| ID | Draft-এর Claim → এখন | ১. Baseline কীভাবে | ২. ডিভাইস/API | ৩. পরিস্থিতি | ৪. Result সংগ্রহ | ৫. গ্রহণযোগ্য (প্রস্তাবিত Gate) |
|---|---|---|---|---|---|---|
| **H1** | "APK ৩০–৪০ MB কমবে" → **Hypothesis** | `v2.4.0` Release APK/AAB থেকে ABI-ভিত্তিক (arm64-v8a) Install-Size ও Download-Size: `apkanalyzer apk file-size/download-size`, `bundletool get-size` | সব ABI-স্প্লিট; Size ডিভাইস-নিরপেক্ষ | Sandbox-সংশ্লিষ্ট নেটিভ/অ্যাসেট (`libproot.so`, `libtalloc.so` ইত্যাদি) সরানো **এবং** নতুন নির্ভরতা (Room, PDF/OCR Library, KDF Library, Tesseract Data) যোগ হওয়ার **নেট** পরিবর্তন | আগে/পরে `apkanalyzer` Diff টেবিল | **নেট Size রিপোর্ট; Claim শুধু পরিমাপকৃত Delta।** Gate: নেট বৃদ্ধি ≤ প্রস্তাবিত বাজেট (Phase 0-এ নির্ধারিত); OCR-ডেটা Optional Download (APK-বহির্ভূত) |
| **H2** | "WebView RAM ৫০%+ কমবে; Renderer Kill উল্লেখযোগ্য কমবে" → **Hypothesis** | নির্ধারিত Scenario-তে `dumpsys meminfo <pkg>` Total PSS (সব Process, Renderer সহ) + `Debug.MemoryInfo`; Kill: `ApplicationExitInfo` (API 30+) / `onRenderProcessGone` গণনা | Low-end ও Mid (Kill-প্রবণ) | Code Mode, ৫০ Turn, ৩ MB Project, ১০ ফাইল Upload, ২০ মিনিট Soak, Background-Foreground চক্র | Peak/Steady-state PSS, Kill-সংখ্যা/ঘণ্টা (N≥১০ রান) | Gate: Median Peak PSS-এ **পরিসংখ্যানগতভাবে তাৎপর্যপূর্ণ হ্রাস** (Baseline-এর IQR ছাড়িয়ে) **এবং** Kill-হার Baseline-এর চেয়ে বেশি নয়। Claim = পরিমাপকৃত % |
| **H3** | "File Search < ৫০ms" → **Hypothesis** | Reference Corpus সংজ্ঞায়িত: N ফাইল/মোট MB (বাস্তব Repo + বাংলা/ইংরেজি/Code Query সেট); Baseline = বর্তমান In-memory BM25 (`injected.js`) | Low/Mid | Cold ও Warm Query; DB Size বৃদ্ধি (১k/৫k/২০k ফাইল) | Macrobenchmark/Instrumented `measureTimeMillis`, p50/p95; `EXPLAIN QUERY PLAN` | Gate (প্রস্তাবিত): Mid-ডিভাইসে ৫k ফাইলে p95 ≤ ১০০ ms; **"<50 ms" Claim কেবল Reference-Corpus-এ নাম-উল্লিখিত ডিভাইসে প্রমাণিত হলে**। Bengali Recall ≥ প্রস্তাবিত থ্রেশহোল্ড (PoF-F1) |
| **H4** | "UI Freeze শূন্য; ফ্রেম < ১৬ms" → **পরিমাপযোগ্য মেট্রিকে** | Macrobenchmark `FrameTimingMetric`/JankStats, `dumpsys gfxinfo framestats`; ANR: `ApplicationExitInfo`; StrictMode | Low/Mid | বড় ফাইল Parse, ১০k-Entry Tree Index, Backup চলাকালীন UI ব্যবহার | Janky-Frame %, p95/p99 Frame Time, Main-thread-block > ১০০ms সংখ্যা, ANR সংখ্যা | Gate: **Soak-এ ANR = ০; StrictMode Disk/Network-on-main = ০**; Janky-Frame % Baseline-এর চেয়ে খারাপ নয়; "শূন্য Freeze" Claim নিষিদ্ধ |
| H5 | Sync Latency (Tier A→COMMITTED; Tier C Verification Overhead) | নতুন (Baseline নেই) | Mid | ১ ফাইল / ২০ ফাইল / `npm install`-ধরনের Bulk Turn | Turn-শেষ→`COMMITTED` সময়; Tier C-এর Token ও Wall-clock খরচ | Gate: ব্যবহারকারীকে Progress দেখানো; Median ও p95 রিপোর্ট; Token-খরচ প্রতি Turn রিপোর্ট (Verification Opt-in) |
| H6 | Backup/Restore Throughput ও Peak RAM | নতুন | Low/Mid | ২০০ MB / ২ GB / ১০k-ফাইল Workspace; Interruption ইনজেক্ট | MB/s, Peak PSS, Free-space ব্যবহার | Gate: কোনো OOM নয়; Interrupted-Backup Restore-এ প্রত্যাখ্যাত; Cross-device Hash ১০০% মিল |
| H7 | Cold Start / Boot | `v2.4.0` Macrobenchmark `StartupTimingMetric` | Low/Mid | Cold/Warm, Room-Migration সহ প্রথম লঞ্চ | TTID/TTFD | Gate: Baseline-এর চেয়ে প্রস্তাবিত % এর বেশি ধীর নয় |
| H8 | ব্যাটারি (`TaskForegroundService`) | `dumpsys batterystats`/Battery Historian | Mid | ৩০ মিনিট Agent Task, Screen-off | mAh অনুমান/Wakelock সময় | Gate: Task-শেষে Service ≤ ৬০ s-এ বন্ধ (Draft-এর সিদ্ধান্ত বহাল); Wakelock Baseline-এ সীমিত |

### ১৭.৩ যা বহাল (Design Requirement, Performance Claim নয়)
- সব ফাইল Parse, SQLite, Sync, GitHub কল `Dispatchers.IO`/`:parse` Process-এ; Main-thread-এ বড় JSON/ফাইল নয় (Design-নিয়ম — H4-এ পরীক্ষিত)।
- `TaskForegroundService` কেবল সক্রিয় Task চলাকালীন; শেষে ≤ ৬০ s-এ বন্ধ (H8-এ যাচাই)।

---

---

## 18. Phased Development Roadmap, Dependencies ও Implementation Guide

**নীতি:** (১) **Phase 0 (Research & PoF) সম্পন্ন ও অনুমোদিত না হওয়া পর্যন্ত কোনো বড় Application Refactor শুরু করা যাবে না।** (২) প্রতিটি Phase স্থিতিশীল Foundation-এর ওপর পরেরটি দাঁড় করায়: Security → Storage → Agent Protocol → Code Sync → GitHub → Files → Memory/Projects → Settings/Release। (৩) Unit Test পাস ≠ Phase সম্পন্ন; যেখানে বাস্তব Arena Session/Android Device/GitHub Repo প্রযোজ্য, সেখানে E2E Evidence ও Evidence Ledger (১৬.৩) বাধ্যতামূলক। (৪) প্রতিটি Phase Feature-flagged ও Rollback-সক্ষম।

**পুরোনো→নতুন Phase ম্যাপ:** পুরোনো Phase 0 (Hygiene) → নতুন Phase 1 · পুরোনো Phase 1 (Storage) → নতুন Phase 2 (+Security আগে Phase 1-এ) · নতুন Phase 3 (Model/Agent Protocol — নতুন) · পুরোনো Phase 2 (Code Sync) → নতুন Phase 4 (Conditional) · পুরোনো Phase 3 (GitHub) → নতুন Phase 5 · পুরোনো Phase 4 (Files) → নতুন Phase 6 · পুরোনো Phase 5 (Memory/Projects/Modes) → নতুন Phase 7 · পুরোনো Phase 6 (Settings/MCP/Release) → নতুন Phase 8।

### Phase 0 — Research, Baseline Audit & Proof of Feasibility (বাধ্যতামূলক গেট; কোনো Production Refactor নয়)
- **Objective:** বড় Architecture-ঝুঁকিগুলো বাস্তব পরীক্ষায় যাচাই করে ADR-এর Status (`Validated/Conditional/Rejected`) চূড়ান্ত করা এবং Performance Baseline নেওয়া।
- **Scope (Workstream):** **0-A** Arena Direct Code Sandbox PoF-S1…S12 (Appendix A.১) · **0-B** Storage/SAF PoF-D1…D7 · **0-C** Backup/KDF PoF-B1…B5 · **0-D** Security PoF-W1…W6, K1…K3 · **0-E** Model Compatibility প্রাথমিক PoF-M1…M6 · **0-F** Parsing PoF-P1…P6 · **0-G** GitHub PoF-G1…G7 · **0-H** Baseline Audit ও H1–H8-এর Baseline পরিমাপ · **0-I** FTS PoF-F1,F2।
- **Dependencies:** Authenticated Arena অ্যাকাউন্ট ও Direct Code Mode-এ প্রবেশাধিকার; ≥ ৩টি Android ডিভাইস (Low/Mid/High, ১৭.১); Scratch GitHub Repo + Fine-grained PAT; Test Corpus (বাংলা/ইংরেজি PDF, Office ফাইল)।
- **Deliverables:** (ক) **PoF Report** — প্রতিটি Test: Objective/Method/Result/Evidence/Status; (খ) Go/No-Go সিদ্ধান্ত (৬.১০.১) ও আপডেটেড ADR Status; (গ) Arena Tool-Event Wire-Format Spec (পর্যবেক্ষিত নমুনাসহ, Redacted); (ঘ) Model Compatibility প্রাথমিক Matrix; (ঙ) Library নির্বাচন (PDF/OCR/KDF); (চ) Baseline Performance Data; (ছ) Bridge Method Inventory; (জ) এই Spec-এর হালনাগাদ।
- **Testing Requirements:** সব PoF বাস্তব Environment-এ; Throwaway Spike কোড মূল `main`-এ Merge নয় (Spike আলাদা স্থান/ব্রাঞ্চে, পরে বাতিলযোগ্য)।
- **Acceptance Criteria:** (১) Appendix A-র প্রতিটি PoF-এর Status `Passed/Failed/Partial` (কোনোটি `Planned` নয়); (২) Sandbox Go/No-Go সিদ্ধান্ত লিখিত; (৩) প্রতিটি `Conditional` ADR-এর Failure-বিকল্প নির্বাচিত; (৪) Baseline ডেটা সংরক্ষিত; (৫) Security PoF-এ W2 (Preview-Iframe) ও W4 (Injection) ফলাফল আছে।
- **Rollback/Migration:** প্রযোজ্য নয় (কোড Merge নেই)। PoF ব্যর্থ হলে Roadmap-এর পরবর্তী Phase পুনর্লিখিত।

### Phase 1 — Hygiene, Security Foundation ও Bridge Migration (P0)
- **Objective:** পরবর্তী সব কাজের নিচে নিরাপদ ভিত্তি: Capability-ভিত্তিক Bridge, Keystore Vault, Legacy Sandbox-এর **নিষ্ক্রিয়করণ (অপসারণ নয়)**।
- **Scope:** (পুরোনো Phase 0 থেকে) `[OFFICE SKILL]` Substring-Match সংশোধন ও Code/Search/Image-এ বন্ধ; `APH:HARNESS_TASK` অপসারণ; অব্যবহৃত ৪৫+ ডিপেন্ডেন্সি পরিষ্কার। **নতুন:** Bridge Inventory ⇒ `addWebMessageListener` + `CapabilityBroker` + `audit_log`; `KeystoreCredentialVault` + Credential Migration (copy-verify-delete); WebView Hardening; Legacy PRoot-এর Prompt-Injection (`sandbox://linux`, `CODE_ADDENDUM` একক `index.html` নির্দেশ) **Feature-flag-এ বন্ধ**; GitHub Token-Entry UI পুনরুদ্ধার (শুধু সংরক্ষণ, Write নয়)।
- **Dependencies:** Phase 0 (W1–W6, K1–K3 ও Library সিদ্ধান্ত)।
- **Deliverables:** Broker, Vault, Legacy-Bridge-Dual-Stack, Migration Tests, Dependency-মুক্ত `package.json`।
- **Testing:** JVM/Robolectric (Vault, Broker Policy); Instrumented (Key-invalidation, Clear Data); **বাস্তব Arena Session** (Bridge Main-frame-only, Preview-Iframe-এ Bridge অনুপস্থিত); Malicious-Iframe Harness; Secret-Leak Scan।
- **Acceptance:** Page-Script/Iframe থেকে W1/N1/G1/C0 Capability কল **০% সফল**; Credential মাইগ্রেশনে Token-হারানো ০; Local PRoot Code Mode-এ আর ব্যবহৃত হয় না (Flag); `npm test`, `./gradlew testDebugUnitTest` সবুজ **এবং** Device E2E Evidence।
- **Rollback/Migration:** Bridge Dual-Stack এক রিলিজ; Vault-Migration-এ Plaintext Legacy কপি যাচাই-পর মোছা (ব্যর্থ হলে অক্ষত); Feature-flag দিয়ে পুরোনো আচরণে ফেরা (শুধু R0/R1)।

### Phase 2 — Unified Native Storage Foundation (P0)
- **Objective:** ডেটা-মালিকানা ও Integrity-সহ Storage: Room + CAS Blob + Workspace + SAF Mirror + Portable Backup।
- **Scope:** §১২.৩ Schema (Room, FTS4 External-Content, Migrations), `WorkspaceFileSystem`, `fs_journal`/RecoveryScanner, `LegacyStoreMigrator` (১২.৫), `SafMirrorManager`, `BackupEngine` (`.apbackup`, ৮.৯), `ArenaWorkspaceDocumentsProvider` (Opt-in, Read-only ডিফল্ট), Protection-Status UI, Restore Wizard।
- **Dependencies:** Phase 0 (D, B, F PoF); Phase 1 (Vault, Broker)।
- **Deliverables:** Schema+Migration Tests, Backup/Restore (Cross-device প্রমাণিত), Mirror Reconciliation, Provider।
- **Testing:** `MigrationTestHelper`; Crash-injection (Journal); **বাস্তব ডিভাইসে Uninstall/Clear Data/Update/Cross-device Restore**; ≥ ২ GB Workspace; Tamper/Wrong-passphrase; v2.4.0→V3 বাস্তব APK Upgrade।
- **Acceptance:** ১০০% Legacy ডেটা Count+Hash-মিল; Interrupted Backup কখনো ভালো Backup Overwrite করে না; Cross-device Restore-এ Hash ১০০% মিল; SAF Folder-মোছা/Grant-হারানো-তে L1 ডেটা অক্ষত; FTS Stale-সারি ০ (Fuzz টেস্ট)।
- **Rollback:** `*.legacy` কপি ৩০ দিন; Schema-Downgrade-এর বদলে Pre-migration `VACUUM INTO` Safety-Copy; Backup ফরম্যাট Versioned।

### Phase 3 — Model Compatibility ও Agent Protocol Core (P0)
- **Objective:** মডেল-বৈচিত্র্য সামলানো Protocol-স্তর (Code Mode Sync-এর আগে)।
- **Scope:** `ModelCapabilityRegistry`, `ToolCallValidator`, `AgentLoopController`, `ContextBudgeter`, `APH/1` Versioned Protocol (`<AP:>`/`<APH:>` একত্রীকরণ), Probe Harness, Stop/Cancel, Backoff, Model-switch Resume Packet, Taint-Escalation।
- **Dependencies:** Phase 0 (M PoF), Phase 1 (Broker), Phase 2 (`tool_calls`, `model_capabilities`, `task_checkpoints`)।
- **Deliverables:** Registry+Probe, Compatibility Matrix (`compat-matrix.json`), Loop State Machine।
- **Testing:** Validator Fuzz/Malformed Corpus; **বাস্তব Arena Session-এ ≥ ৩টি মডেল × Repository Task Suite (৫.৪.১১)**।
- **Acceptance:** Tier নির্ধারণ Acceptance-Criteria অনুযায়ী; Malformed Tag থেকে আংশিক Execute ০; Duplicate-Stream-এ Double-Execute ০; Stop সম্মানিত (`stopHonored` পরিমাপসহ)।
- **Rollback:** Registry-অনুপস্থিতিতে সব মডেল `T1`; `APH/1` Legacy-Tag-সামঞ্জস্য-স্তর এক রিলিজ।

### Phase 4 — Code Mode: Official Sandbox Capture, Verification ও Hydration (P0 — **Conditional** Phase 0 Go-সিদ্ধান্তে)
- **Objective:** Phase 0-এ প্রমাণিত স্তর অনুযায়ী (GO-FULL/CHECKPOINT/ASSISTED) Verified Sync।
- **Scope:** `SyncIngest` (State Machine ৬.৫, Atomic Commit ৬.৬, Conflict ৬.৭), Tier A/B/C Adapter (শুধু PoF-প্রমাণিত অংশ), Hash-Verified Hydration (৬.৮), Export/Recovery (৬.১০), V3 Code Mode Playbook, **Legacy PRoot চূড়ান্ত অপসারণ** (Export Wizard-নিশ্চিতির পর: `Sandbox.kt`, `SandboxTools.kt`, `StudioActivity.kt`, `libproot.so`; `TarGz.kt` **রাখা** — Archive Parser ব্যবহার করে)।
- **Dependencies:** Phase 0 (S1…S12 + Go/No-Go), Phase 2, Phase 3।
- **Deliverables:** Sync Engine + Adapters, Diff/Snapshot UI, Canary Test (Format-drift), Hydration Verify Report।
- **Testing:** `SyncIngestTest` (Duplicate/Partial/Out-of-order/Poisoned), Crash-injection, **বাস্তব Arena Direct Code Session-এ E2E:** Create/Edit/Delete/`bash` Bulk/`npm install`/Binary/Large/Reset→Hydrate (PoF-S1…S12 পুনরাবৃত্তি Regression হিসেবে)।
- **Acceptance:** "Verified" ফাইলের Hash Sandbox-Attested Hash-এর সাথে ১০০% মিল; কোনো Unverified ফাইল "Saved" নয়; Sandbox Reset-পর Hydration-এ ≥ প্রস্তাবিত % ফাইল Hash-মিল (PoF-S11 ফলাফল থেকে সংজ্ঞায়িত) ও অমিল স্পষ্ট রিপোর্ট; NO-GO হলে এই Phase বাতিল/পুনর্লিখিত।
- **Rollback:** Sync Feature-flag; Legacy-PRoot-ডেটা Export Wizard ছাড়া মোছা নিষিদ্ধ; Tier-ভিত্তিক Gradual Enable।

### Phase 5 — Native GitHub Agent (P0 — Code Mode Core)
- **Objective:** নিরাপদ, Feature-Branch-ভিত্তিক GitHub Workflow।
- **Scope:** `GitHubAgentEngine` (Tree/Subtree Recovery, Raw Blob Stream, Atomic Commit + Journal, Branch Race/Non-FF হ্যান্ডলিং, Rate-limit/ETag, PR, Actions Dispatch/Artifact), Repository Map/On-demand Retrieval, Diff & Commit Confirmation Sheet, Secret-Scan, Policy (Main-protect)।
- **Dependencies:** Phase 0 (G), Phase 1 (Vault/Broker), Phase 2 (Storage, `file_versions`)।
- **Deliverables:** Engine, UI Sheets, Policy Tests।
- **Testing:** MockWebServer (Race/429/422); **বাস্তব Scratch GitHub Repo E2E** (Branch→Commit→PR→Actions→Artifact; `truncated=true` বড় Repo; Concurrent Commit)।
- **Acceptance:** Default/Protected Branch-এ Write ০ (Policy+Negative Test); Non-FF-এ স্বয়ংক্রিয় Overwrite ০; Commit-পর `GET ref` Head==Commit SHA যাচাই; Ref-Update-পূর্ব ব্যর্থতায় Repo-State অপরিবর্তিত।
- **Rollback:** Write-Capability আলাদা Flag/Token; Read-only মোড স্থায়ী ফলব্যাক।

### Phase 6 — Multi-Format Upload ও Analysis (P1)
- **Objective:** সৎ (Fidelity-Report-সহ) ফাইল-বিশ্লেষণ।
- **Scope:** `FileAnalysisEngine` (১০.৪), `:parse` Process, PDF Tiered Extractor+OCR/Vision Fallback, DOCX/XLSX/PPTX/CSV/ZIP, Attachment Tray+Fidelity Report, ২৪-ঘণ্টা Cleanup।
- **Dependencies:** Phase 0 (P), Phase 2।
- **Testing:** Corpus (বাংলা/ইংরেজি; Legacy-font; Scanned); Low-RAM Device বড় PDF; Zip-bomb/Malformed।
- **Acceptance:** কোনো Format "Fully supported" দাবি নয়; প্রতিটি Parse-এ Fidelity Report; PDF Accuracy (CER) PoF-P1-এর নির্ধারিত Threshold-এর ওপরে অথবা Fallback সক্রিয়; Parser Crash-এ Main App অক্ষত।
- **Rollback:** Parser-ভিত্তিক Flag; ব্যর্থ ফাইল Original হিসেবে সংরক্ষিত।

### Phase 7 — Memory, Projects ও চার Direct Mode সম্পূর্ণকরণ (P1)
- **Scope:** `MemoryEngine`/`ProjectEngine` (Scope-Isolation, `.approject.zip`→Backup ফরম্যাটের সাথে সমন্বিত), Search Mode (Readability+Citation Ledger), Image Mode (Zero-injection, Gallery, `generated_images`)।
- **Dependencies:** Phase 2, 3; Phase 6 (Project-Upload)।
- **Testing:** `MemoryAndProjectIsolationTest` (Project A→B Leak ০, Fuzz); বাস্তব Arena Image-Mode Session (Zero-injection Byte-Equality); Search Mode Citation যাচাই।
- **Acceptance:** Isolation Leak ০; Image Mode `userMessage.content === rawUserInput`; Gallery-সংরক্ষণ Hash-যাচাইকৃত।
- **Rollback:** Memory Injection ডিফল্ট OFF (Opt-in) বহাল।

### Phase 8 — Native Settings, MCP আপগ্রেড, Performance যাচাই ও Release (P1)
- **Scope:** ৯-ক্যাটাগরি Native Settings; **MCP Spec পুনঃযাচাই (২.৪ [UA] সমাধান) ও তারপর** Client আপগ্রেড; H1–H8 পূর্ণ Benchmark; Release `v3.0.0`।
- **Dependencies:** সব পূর্ববর্তী Phase।
- **Testing:** পূর্ণ Suite + Device Matrix; Performance Before/After (১৭.২); Security Re-audit।
- **Acceptance:** সব Phase Evidence Ledger সম্পূর্ণ; Performance **শুধু পরিমাপকৃত** সংখ্যা Release Note-এ; Open PoF/Unverified তালিকা Release-এ প্রকাশিত।
- **Rollback:** Staged Rollout (Beta Channel আগে); Migration-Rollback ৩০ দিন।

---

---

## 19. Technical Risks, Honest Limitations ও Unresolved Questions

1. **Arena.ai-এর Cloudflare ও reCAPTCHA v3 সীমাবদ্ধতা (Honest Limitation):**
   - `arena.ai`-এর চ্যাট এন্ডপয়েন্ট (`/nextjs-api/stream/*`) এবং মডেল ক্যাটালগ Cloudflare ক্লিয়ারেন্স কুকি ও পেজ-মিন্টেড `recaptchaV3Token` দ্বারা সুরক্ষিত।
   - **বাস্তব সিদ্ধান্ত:** অ্যাপ কখনোই নেটিভ `OkHttp` থেকে সরাসরি চ্যাট মেসেজ পাঠাবে না; সমস্ত চ্যাট মেসেজ ও টুল রেজাল্ট সবসময় WebView-এর ভেতরে পেজের নিজস্ব কমপোজার ও সেন্ড ফ্লো দিয়েই যাবে।
2. **Arena Official Sandbox-এর DOM / Stream ফরম্যাট পরিবর্তন:**
   - Arena.ai ভবিষ্যতে তাদের Code Arena-এর স্ট্রিম ইভেন্ট বা CodeMirror DOM ক্লাস পরিবর্তন করতে পারে।
   - **প্রতিকার:** ফাইল ক্যাপচারিংয়ের জন্য একক DOM সিলেক্টরের ওপর নির্ভর না করে **ডুয়াল-লেয়ার ক্যাপচার** (প্রাথমিক: নেটওয়ার্ক স্ট্রিম ইন্টারসেপশন `ap-stream-hook.js`; দ্বিতীয়: CodeMirror DOM অবজারভার + মডেল-এমিটেড স্ন্যাপশট ম্যানিফেস্ট) ব্যবহার করা হবে।
3. **অফিসিয়াল স্যান্ডবক্সে বিশাল বাইনারি ফাইল পাঠানো:**
   - যেহেতু অফিসিয়াল স্যান্ডবক্সে সরাসরি ফাইল সিস্টেম মাউন্ট নেই, তাই কয়েকশ মেগাবাইটের বাইনারি ফাইল কমপোজার টেক্সটের মাধ্যমে স্যান্ডবক্সে পাঠানো যাবে না।
   - **প্রতিকার:** সোর্স কোড ও টেক্সট ফাইলগুলো কমপোজার হাইড্রেশনের মাধ্যমে যাবে, আর বড় রিপোজিটরি বা বাইনারি অ্যাসেট সংযুক্ত GitHub ব্রাঞ্চ (`git clone` / `curl` ইন অফিসিয়াল স্যান্ডবক্স) এর মাধ্যমে আদান-প্রদান হবে।

### ১৯.R1 Revision R1-এ যুক্ত ঝুঁকি, সীমাবদ্ধতা ও অমীমাংসিত প্রশ্ন

> **§১৯ আইটেম ২ ও ৩-এর R1 মন্তব্য:** "ডুয়াল-লেয়ার ক্যাপচার (Stream + DOM + মডেল-নির্গত Manifest)" **পরিত্যক্ত** — মডেল-নির্গত Manifest বিশ্বাসযোগ্য নয় (৬.৩ #5); প্রতিস্থাপক: Tiered Capture + Sandbox-Attested Verification (৬.৪)। "GitHub ব্রাঞ্চ (`git clone`/`curl` ইন Sandbox) দিয়ে বড় ফাইল আদান-প্রদান"-এ Credential-সহ Push **নিষিদ্ধ**; Credential-ছাড়া Public-Source Clone শুধু Sandbox-এ নেটওয়ার্ক থাকলে (**[UA]**)।

| # | ঝুঁকি/সীমাবদ্ধতা | ধরন | প্রভাব | Mitigation/অবস্থা |
|---|---|---|---|---|
| R1-1 | Arena `/code/direct`-এর Sandbox, Tool, Persistence, Reset আচরণ অজানা | [UA]/[PoF] | Code Mode-এর মূল পণ্য-দাবি | Phase 0-A; Go/No-Go ম্যাট্রিক্স (৬.১০.১); দাবি PoF-সীমার মধ্যে |
| R1-2 | Arena ঘোষণা ছাড়া Stream/DOM/Tool-Format বদলাতে পারে (তৃতীয়-পক্ষ সাইট) | [KL] | Capture নীরবে ভাঙা | Canary Tests; Schema-Drift শনাক্তে Sync অটো-ডিসেবল ও ব্যবহারকারীকে সতর্কতা; কখনো নীরব ব্যর্থতা নয় |
| R1-3 | Arena-র ToS/Policy ও স্বয়ংক্রিয় Scraping/Automation-এর বৈধতা | [UA] | Account/Distribution ঝুঁকি | Phase 0-এ Arena ToS পাঠ ও লিখিত মূল্যায়ন; Composer-এ Visible, Opt-in, ব্যবহারকারী-Initiated Command (৬.৪ Tier C) |
| R1-4 | LLM-মধ্যস্থ Hydration/Verification Token-খরচ ও অসম্পূর্ণতা | [KL] | খরচ/ধীর | Manifest-First, Selective Retry, Opt-in; খরচ H5-তে পরিমাপ |
| R1-5 | Uninstall/Clear Data-এ L1 ডেটা অনিবার্যভাবে হারায় | [KL] | ডেটা-ক্ষতি | Protection-Status UI, L2/L3/GitHub উৎসাহিত, Backup-অনুস্মারক (৮.৫) |
| R1-6 | SAF সীমাবদ্ধতা (Grant হারানো, ধীর Tree, Non-atomic) ও Grant-সীমা | [KL][RF-Secondary] | Mirror ব্যর্থতা | Reconciliation, Detached/Missing-State, Grant-সীমা (৮.৮) |
| R1-7 | ব্যবহারকারী Passphrase+Recovery Key দুটোই হারালে Backup অপুনরুদ্ধারযোগ্য | [KL] | স্থায়ী ক্ষতি | স্পষ্ট UX-সতর্কতা, Recovery Key সংরক্ষণ-যাচাই ("Test Restore") |
| R1-8 | Bridge Migration Compatibility (WebView < ৮২/OEM WebView) | [UA→PoF-W3] | Privileged Feature অক্ষম হতে পারে | Degraded Read-only; ব্যবহারকারীকে WebView আপডেটের নির্দেশ |
| R1-9 | Prompt Injection সম্পূর্ণ প্রতিরোধযোগ্য নয় | [KL] | সংবেদনশীল Side-effect | Policy-outside-Model + Consent + Taint-Escalation (১৩.৬); নিরাপত্তা-দাবি "মডেল প্রতারিত হতে পারে, কিন্তু Consent ছাড়া ক্ষতি নয়" |
| R1-10 | PDF Text API ≤ API 34-এ অনুপস্থিত; বাংলা PDF Accuracy অজানা (Legacy-font ঝুঁকি) | [VF][UA] | ফাইল-বিশ্লেষণ গুণমান | Tiered Extractor+OCR/Vision; PoF-P1/P2; Fidelity Report |
| R1-11 | `minSdk=26`/`targetSdk=34`; API 35 API সরাসরি ব্যবহারে `compileSdk` বৃদ্ধি ও Reflection/Extension-গার্ড | [VF] | Build/Compat | `SdkExtensions` চেক; `compileSdk` আপগ্রেড আলাদা Phase-1 টাস্ক হিসেবে মূল্যায়ন |
| R1-12 | GitHub Secondary Rate-limit অস্পষ্ট ও পরিবর্তনশীল | [KL][RF] | Commit ব্যর্থ/Throttle | Serial Writes, Backoff, ছোট Batch (৭.৫.২) |
| R1-13 | Fine-grained PAT সব Org/Workflow-এ কাজ নাও করতে পারে; Device Flow-এ App Registration লাগে | [KL][RF] | Onboarding ঘর্ষণ | PAT Primary; Device Flow Post-3.0 |
| R1-14 | মডেল-স্তরে Compatibility Matrix পুরোনো হয়ে যায় (মডেল/Arena পরিবর্তন) | [KL] | ভুল Trust Tier | ৯০-দিন/Drift-Trigger পুনঃপরিমাপ (৫.৪.১১) |
| R1-15 | Arena Feature Flag `agent-mode-workspace-storage` ইঙ্গিত দেয় Arena নিজেই কিছু Workspace-Storage দিতে পারে | [UA] | পুনর্নির্মাণ/ওভারল্যাপ | PoF-S10/S11; ওভারল্যাপ পেলে ArenaPilot দায়িত্ব ছাঁটা (৬.৯) |
| R1-16 | MCP Spec সংস্করণ-দাবি অযাচাইকৃত | [UA] | Phase 8 | Phase 8-এর আগে Re-verify |
| R1-17 | Mock-Harness-সবুজ ≠ বাস্তব Arena-সবুজ | [KL] | ভ্রান্ত আত্মবিশ্বাস | ১৬.৩ বাস্তব Session বাধ্যতামূলক |
| R1-18 | Spec-এর নিজস্ব Library-সংস্করণ/API-তথ্য (যেমন SQLite FTS Tokenizer, Keystore Clear-Data আচরণ) কিছু Official Doc-এ সরাসরি যাচাই হয়নি | [UA] | ভুল অনুমান | যথাস্থানে [UA/PoF] ট্যাগ; PoF-D1, F1 |

**অমীমাংসিত প্রশ্ন (Phase 0-এর আগে উত্তর দরকার):** (১) Direct Code Mode-এ Official Sandbox কি Arena-র `/code` Fullstack Sandbox-এর সমান? (২) Tool Result স্ট্রিমে/DOM-এ কতটা দৃশ্যমান, Truncation-সীমা কত? (৩) `bash`-এ Sandbox-এ নেটওয়ার্ক/Package-Install কাজ করে কি? (৪) Arena কি Download/Export UI দেয়? (৫) Session Reset-এ ফাইল-সিস্টেম অবশিষ্ট থাকে কি? (৬) Preview-Iframe-এর Origin ও Sandbox Attribute কী? (৭) Android 8–11 ডিভাইসে বাংলা PDF-এর সর্বোত্তম Extraction Library কী? (৮) Argon2id Library-র Maintenance/Licence/আকার গ্রহণযোগ্য কি? (৯) Clear Data-এ Keystore Key ও SAF Grant-এর বাস্তব আচরণ? (১০) GitHub `truncated` Subtree-Recovery-র বাস্তব Rate-limit খরচ?

---

## 20. Architecture Decision Records (ADR-001 থেকে ADR-014)

**Status সারসংক্ষেপ:** কোনো ADR-ই এখনো `Validated` নয় (Arena-সংক্রান্ত বিষয়ে PoF ছাড়া `Validated` নিষিদ্ধ)। ADR-009 (মূল রূপ) **Rejected**; প্রতিস্থাপক ADR-009-R1। ADR-011…014 R1-এ যুক্ত। প্রতিটি ADR-এ: Context/Problem · বিকল্প · সিদ্ধান্ত · কারণ · প্রযুক্তিগত প্রমাণ · সুবিধা/অসুবিধা · Security/Maintenance Impact · Failure Scenario · Migration Strategy।

| ADR | শিরোনাম | Status |
|---|---|---|
| 001 | Official Sandbox একমাত্র; PRoot নিষ্ক্রিয়→অপসারণ | **Conditional** (Constraint স্থির; অপসারণ-ক্রম PoF-নির্ভর) |
| 002 | Room (WAL+FTS4 External-Content)+Workspace Files | **Proposed** (FTS-Tokenizer Conditional) |
| 003 | DocumentsProvider+SAF Mirror | **Conditional** (Durability-দাবি **প্রত্যাহৃত**) |
| 004 | Git Data API Engine | **Conditional** (Read আংশিক যাচাইকৃত [VF]; Write অপরীক্ষিত) |
| 005 | Native Multi-format Parsing | **Conditional** (PDF Library/OCR নির্বাচন PoF) |
| 006 | Memory/Project Scope Separation | **Proposed** |
| 007 | Image Mode Zero-injection | **Proposed** |
| 008 | Strangler-Fig De-minification | **Proposed** |
| 009 | ~~`EncryptedCredentialVault` (`security-crypto`)~~ | **Rejected** → 009-R1 |
| 009-R1 | `KeystoreCredentialVault` (প্ল্যাটফর্ম Keystore) | **Proposed** |
| 010 | Turn Ledger ও Task Checkpoint | **Conditional** (Stream-Event-নির্ভর অংশ) |
| 011 | Tiered Capture + Verified Ingest Sync | **Conditional** (PoF-S1…S12) |
| 012 | ৩-স্তর Storage ও Portable Encrypted Backup | **Proposed** (KDF Conditional) |
| 013 | Capability-Brokered WebMessage Bridge | **Proposed** (PoF-W2/W3) |
| 014 | Model Capability Registry ও `APH/1` Protocol | **Proposed** |

### ADR-001: Official Sandbox একমাত্র Execution Environment; Local PRoot নিষ্ক্রিয়করণ ও পরে অপসারণ — **Conditional**
- **Context/Problem:** v2.4.0-এ Local PRoot/Alpine Sandbox (`Sandbox.kt`, `libproot.so`) Arena-র নিজস্ব Sandbox-এর সাথে দ্বন্দ্ব তৈরি করে [VF Audit]। পণ্য-নির্দেশ: দ্বিতীয় Execution Environment নিষিদ্ধ।
- **বিকল্প:** (ক) PRoot রেখে দেওয়া (পণ্য-নির্দেশে নিষিদ্ধ); (খ) তাৎক্ষণিক মোছা (ব্যবহারকারীর ডেটা-ক্ষতি ঝুঁকি); (গ) **নিষ্ক্রিয় (Flag) → Export Wizard → অপসারণ**।
- **সিদ্ধান্ত:** (গ)। Prompt-Injection ও ব্যবহার Phase 1-এ বন্ধ; Code/Data অপসারণ Phase 4-এ Export-নিশ্চিতির পর।
- **কারণ:** পণ্য-নির্দেশ পূরণ + ডেটা-নিরাপত্তা।
- **প্রমাণ:** Repo-তে Legacy কম্পোনেন্ট বিদ্যমান [VF]; Arena Sandbox-এর Persistence/Capture ক্ষমতা **অপ্রমাণিত** [UA] — তাই "Official Sandbox ডেটা Android-এ সংরক্ষণ করবে" অংশ ADR-011-এ Conditional।
- **সুবিধা/অসুবিধা:** + এক Execution Environment, সরল Maintenance; − Arena-নির্ভরতা (অফলাইনে Code Execution নেই); APK আকার হ্রাস **Hypothesis** (H1)।
- **Security/Maintenance:** আক্রমণ-পৃষ্ঠ কমে (লোকাল MCP Server বন্ধ); Maintenance কমে।
- **Failure:** PoF NO-GO ⇒ Code Mode-এ Android-সংরক্ষণ সীমিত; পণ্য-দাবি সংকুচিত (৬.১০.১); Local Sandbox **ফিরবে না** (নির্দেশ) — বিকল্প Export/Assisted মোড।
- **Migration:** ১২.৫ (৩): Rootfs Workspace Import Wizard; ব্যবহারকারী-নিশ্চিত Delete।

### ADR-002: Monolithic JSON Blob (`EngineStore`) → Room (WAL+FTS4) + Workspace Files — **Proposed**
- **Context:** সব ডেটা একক JSON ও সিঙ্ক্রোনাস `@JavascriptInterface` পারাপার [VF Audit ১.৩.৩]।
- **বিকল্প:** (ক) JSON রাখা; (খ) **Room/SQLite**; (গ) SQLDelight; (ঘ) Realm/ObjectBox।
- **সিদ্ধান্ত:** (খ) — AndroidX মান্য, Migration-টুলিং (`MigrationTestHelper`), FTS4 সমর্থন; External-Content FTS (১২.৩.৩)।
- **কারণ:** Platform-সমর্থিত, Dependency-সংক্ষিপ্ত, টেস্টযোগ্য।
- **প্রমাণ:** Schema অসংগতি R1-এ চিহ্নিত/সংশোধিত [VF]; **FTS Tokenizer বাংলায় কেমন — [UA→PoF-F1]**; Room-এ FTS5 অসমর্থিত/Android SQLite-এ প্রাপ্যতা অনিশ্চিত [UA]।
- **সুবিধা/অসুবিধা:** + ACID, Index; − FTS4 সীমা, Schema-Migration দায়।
- **Security/Maintenance:** DB App-private (Android 10+ এনক্রিপ্টেড স্টোরেজ [RF Official]); DB-তে Secret নয়। Migration-Test বাধ্যতামূলক।
- **Failure:** Migration-Bug ⇒ Pre-migration `VACUUM INTO` Safety-Copy; FTS Corruption ⇒ `rebuild`।
- **Migration (ভবিষ্যৎ বদল):** Repository Interface-পেছনে; Export→Import (Backup ফরম্যাট) দিয়ে Engine-পরিবর্তন সম্ভব।

### ADR-003: `DocumentsProvider` + SAF Mirror — **Conditional** (**Durability-দাবি প্রত্যাহৃত**)
- **Context:** অন্য অ্যাপ/ব্যবহারকারীর Files-অ্যাপ থেকে Workspace অ্যাক্সেস ও ব্যবহারকারী-মালিকানাধীন কপি।
- **বিকল্প:** (ক) শুধু DocumentsProvider; (খ) শুধু SAF Mirror; (গ) **উভয় — ভিন্ন দায়িত্বে**; (ঘ) `MANAGE_EXTERNAL_STORAGE` (Play-নীতি-বিরুদ্ধ)।
- **সিদ্ধান্ত:** (গ): Provider = **অ্যাক্সেস/Interop**; SAF Mirror + Backup = **Durability**। Draft-এর "কোনো ঝুঁকি ছাড়াই পূর্ণাঙ্গ নেটিভ ফাইল অভিজ্ঞতা/স্থায়িত্ব" দাবি বাতিল।
- **প্রমাণ:** App-specific Storage Uninstall-এ মোছে [RF Official]; Provider ডেটা-ধারণ করে না (যৌক্তিক) [PoF-D2]; Grant-সীমা ও আচরণ [RF Secondary → PoF-D4]।
- **সুবিধা/অসুবিধা:** + Play-সম্মত; − SAF ধীর/Non-atomic, Grant-ভঙ্গুরতা।
- **Security:** Provider `MANAGE_DOCUMENTS`, Path-Traversal-গার্ড, Opt-in; Mirror-এ Secret নয়।
- **Failure:** Grant হারানো/Folder মোছা ⇒ `DETACHED/MISSING`, L1 অক্ষত (৮.৬)।
- **Migration:** Mirror→নতুন Folder Re-pick; Provider অপসারণযোগ্য (L1 অপরিবর্তিত)।

### ADR-004: Native GitHub Git Data API Engine — **Conditional**
- **Context:** Local `git` ছাড়া Branch/Multi-file Commit/PR।
- **বিকল্প:** (ক) **REST Git Data API**; (খ) GraphQL `createCommitOnBranch` (Verified-commit, একক-কলে Multi-file সম্ভব [RF-স্মৃতি; PoF-G3 এ তুলনা]); (গ) Embedded Git (JGit — ভারী); (ঘ) Sandbox-`git`+Token (**নিষিদ্ধ**—Credential-ঝুঁকি)।
- **সিদ্ধান্ত:** (ক) Primary; (খ) PoF-G3-তে তুলনা (Atomicity/Rate-limit/Delete-Rename সমর্থন)।
- **প্রমাণ:** Tree ১০০,০০০/৭MB ও Blob ১০০MB সীমা [VF Official]; এই Repo-তে Read-পরীক্ষা সফল [VF]; Write/Race/Actions **অপরীক্ষিত** [PoF-G3…G5]।
- **সুবিধা/অসুবিধা:** + ক্লোন ছাড়া; − Rate-limit, Large-Repo জটিলতা, LFS অসমর্থিত।
- **Security:** Feature-Branch-only, Broker-Policy, Secret-scan (৭.৫.৫)।
- **Failure:** Non-FF/422/Rate-limit ⇒ থামা+ব্যবহারকারীকে জানানো; Journal-ভিত্তিক Idempotent Retry।
- **Migration:** Engine Interface-পেছনে; GraphQL/অন্য পথে বদলানো সম্ভব।

### ADR-005: Native Multi-format Parsing (`FileAnalysisEngine`) — **Conditional**
- **Context:** Arena `<input type=file>` শুধু ছবি নেয় [VF Audit]।
- **বিকল্প:** (ক) Native Parse + Markdown Context; (খ) Page-Image রেন্ডার→Vision মডেল (শুধু Image-সক্ষম মডেল); (গ) Server-Side Parse (**নিষিদ্ধ** — গোপনীয়তা)।
- **সিদ্ধান্ত:** (ক)+(খ) Hybrid; Format-ভিত্তিক Support Level ও Fidelity Report (১০.৪)।
- **প্রমাণ:** `PdfRenderer` Text API ≥ API 35 [VF Official]; `minSdk=26` [VF] ⇒ Library লাগবে; বাংলা Accuracy অজানা [UA→PoF-P1]।
- **সুবিধা/অসুবিধা:** + মডেল-নিরপেক্ষ; − Layout/Table ক্ষতি, Library আকার/Licence, OCR বাংলা অনিশ্চিত।
- **Security:** `:parse` Process, Zip-slip/bomb/XXE গার্ড, Untrusted Fencing।
- **Failure:** Parse-ব্যর্থ ⇒ Honest Failure; Original সংরক্ষিত।
- **Migration:** Parser প্লাগেবল (`parser_id/version` রেকর্ডে) — Library বদলে পুনঃ-Parse।

### ADR-006: Memory/Project Scope Separation — **Proposed**
- **Context:** v2.4.0 গ্লোবাল Flat Memory [VF Audit]।
- **বিকল্প:** (ক) Flat; (খ) **Scope+FK+CHECK+UNIQUE**; (গ) আলাদা DB-ফাইল/Project।
- **সিদ্ধান্ত:** (খ) (১২.৩ E13) + DAO-স্তরে প্রতি-Query `projectId` বাধ্যতামূলক; (গ) Backup/Delete সহজ হলেও ক্রস-Query জটিল — প্রত্যাখ্যাত।
- **প্রমাণ:** Isolation কেবল টেস্টে প্রমাণযোগ্য — `MemoryAndProjectIsolationTest` (Fuzz) Phase 7।
- **সুবিধা/অসুবিধা:** + Leak-প্রতিরোধ; − Global/Project মিশ্র Retrieval-লজিক।
- **Security/Privacy:** Memory Injection ডিফল্ট OFF; Project Memory Prompt-এ গেলে Arena-য় যায় (ব্যবহারকারীকে জানানো)।
- **Failure:** Scope-Bug ⇒ Cross-project Leak ⇒ Release-Blocker Test।
- **Migration:** Legacy Memory→`GLOBAL`; ব্যবহারকারী Project-এ সরাতে পারে।

### ADR-007: Image Mode-এ Zero Prompt Contamination — **Proposed**
- **Context:** Image-Modality-তে Injection ছবির প্রম্পট নষ্ট করে।
- **বিকল্প:** (ক) Hard-bypass; (খ) Filtered Injection।
- **সিদ্ধান্ত:** (ক): `inject:false, tools:false, memory:false`।
- **প্রমাণ:** v2.4.0 `image` প্রোফাইলে `inject:false` [Audit ১.২; আচরণ Byte-Equality টেস্ট এখনো নেই]।
- **সুবিধা/অসুবিধা:** + বিশুদ্ধতা; − Memory/Style-হেল্পার নেই (Prompt Studio ঐচ্ছিক, ব্যবহারকারী-নিয়ন্ত্রিত)।
- **Security:** Image Mode-এ Bridge-Capability সংকুচিত (শুধু Gallery-সংরক্ষণ)।
- **Failure:** Modality-Misdetect ⇒ ভুল Injection ⇒ Modality ফ্যালব্যাক "Inject OFF-if-unsure" (Persisted Modality, ১২.৩)।
- **Migration:** Profile-ভিত্তিক Flag।

### ADR-008: Strangler-Fig De-minification — **Proposed**
- **Context:** ৩.৩৫ MB Minified `content.js`-এ String-patch [VF Audit]।
- **বিকল্প:** (ক) Patch চালানো; (খ) **নতুন Logic Native+Unminified `ap-*.js`**; (গ) Source পুনর্গঠন।
- **সিদ্ধান্ত:** (খ), বিদ্যমান Bundle ধাপে-ধাপে হ্রাস।
- **প্রমাণ:** Source Repo-তে নেই [VF]।
- **সুবিধা/অসুবিধা:** + Maintainability; − দীর্ঘ Dual-Run, Regression-ঝুঁকি।
- **Security:** Injected Script Untrusted World-এ — Secret/Privileged-Logic নয় (১৩.১); `innerHTML` নিষিদ্ধ।
- **Failure:** Adapter ভাঙলে Native Fallback UI; Canary।
- **Migration:** Feature-ভিত্তিক Migration।

### ADR-009 (মূল): `EncryptedCredentialVault` via `security-crypto` — **Rejected**
- **কারণ:** `security-crypto` সব API Deprecated [VF Official ২.৫]; এবং Consequence "XSS-তেও Token ফাঁস **অসম্ভব**" প্রযুক্তিগতভাবে ভুল (Confused-Deputy, ১৩.১)।

### ADR-009-R1: `KeystoreCredentialVault` (প্ল্যাটফর্ম Keystore) — **Proposed**
- **Context:** GitHub PAT/MCP Key Plaintext [VF Audit ১.৩.৫]।
- **বিকল্প:** (ক) `security-crypto` (Deprecated); (খ) **প্ল্যাটফর্ম Keystore + AES-GCM Envelope**; (গ) Tink; (ঘ) Plaintext।
- **সিদ্ধান্ত:** (খ) (Tink-তুলনা Phase 1 Spike)।
- **কারণ:** Official দিকনির্দেশ ("platform APIs and direct use of Android Keystore") [VF]; Dependency-সংক্ষিপ্ত।
- **প্রমাণ:** Release Notes [VF]; Clear-Data/Invalidation আচরণ [UA→PoF-K1]।
- **সুবিধা/অসুবিধা:** + Maintenance-ঝুঁকি কম, AAD-বাউন্ড; − নিজস্ব Envelope-কোড দায় (Review/Test)।
- **Security:** শুধু Storage-সুরক্ষা — **Authorization আলাদা (ADR-013)**; Root-সীমা [KL]।
- **Failure:** Key নষ্ট ⇒ Vault Reset+পুনঃপ্রবেশ; Migration-ব্যর্থ ⇒ Plaintext অক্ষত।
- **Migration:** Envelope `v1` Versioned; Tink-এ যেতে Decrypt→Re-encrypt।

### ADR-010: Native Turn Ledger ও Task Checkpointing — **Conditional**
- **Context:** `sdsArenaRing` ১৬-টার্ন Volatile [VF]।
- **বিকল্প:** (ক) Ring রাখা; (খ) **Native Ledger** (`conversation_turns` + `tool_calls` + `task_checkpoints`)।
- **সিদ্ধান্ত:** (খ); Turn-Text (`a0:`) ধারণ [VF Parser আছে]; Tool-Event অংশ Stream-Format-নির্ভর [UA→PoF-S1]।
- **সুবিধা/অসুবিধা:** + Crash-সহনশীল; − Stream-Debounce/Write-Amplification (H4-এ পরিমাপ)।
- **Security:** Ledger-এ Secret নয়; Backup-এ ঐচ্ছিক।
- **Failure:** Stream অসম্পূর্ণ ⇒ `stream_complete=false` (১৪.৩)।
- **Migration:** Ledger Schema Versioned।

### ADR-011: Tiered Capture + Hash-Verified Ingest Sync — **Conditional** (PoF-S1…S12; **`Validated` নয়**)
- **Context/Problem:** Official Sandbox থেকে ফাইল Android-এ নির্ভরযোগ্যভাবে সংরক্ষণ; Stream/DOM-এর সম্পূর্ণতা/নির্ভুলতা অজানা (৬.৩)।
- **বিকল্প:** (ক) V3-Draft Tri-Channel (Stream+DOM+Model-Manifest) — **Rejected** (Model-Manifest অবিশ্বাস্য, Event≠State); (খ) **Tiered Capture + Sandbox-Attested Verification + Verified-only Commit**; (গ) শুধু ব্যবহারকারী-Export/Import; (ঘ) দ্বিতীয় Sandbox/Local Mirror Execution (**নিষিদ্ধ**)।
- **সিদ্ধান্ত:** (খ), ফলাফল-অনুযায়ী (গ)-এ Graceful Degrade (Go/No-Go ৬.১০.১)।
- **কারণ:** "যা যাচাই হয়নি তা Saved নয়" নীতি; Tool-Call (Intent) ও File-State আলাদা।
- **প্রমাণ:** Repo-তে Tool-Event Parser নেই [VF]; Arena Blog Tool-Call-এর অস্তিত্ব বলে, Wire-Format বলে না [RF]; CM6 Viewport-সীমা সাধারণ জ্ঞান [UA]; সব PoF **Planned**।
- **সুবিধা/অসুবিধা:** + ভুল/Corrupt ফাইল Working Tree-তে ঢোকে না; Version/Conflict/Recovery; − Tier C-তে মডেল-Cooperation ও Token-খরচ; Real-time নয় (সম্ভবত Turn-Checkpoint)।
- **Security/Maintenance:** Path-Scope, Poisoned-Input প্রত্যাখ্যান; Canary; Arena-Drift-এ Adapter ভাঙা — Maintenance-ভার বেশি [KL]।
- **Failure:** Tier A/B/C সব ব্যর্থ ⇒ `UNVERIFIED`, Export Fallback; Arena Format বদল ⇒ Auto-disable+সতর্কতা।
- **Migration:** Tier-ভিত্তিক Adapter প্লাগেবল; Storage/Schema (`sync_events`) Tier-নিরপেক্ষ — Tier বদলে Data-Model অপরিবর্তিত।

### ADR-012: ৩-স্তর Storage ও Portable Encrypted Backup — **Proposed** (KDF **Conditional**)
- **Context:** L1 Uninstall/Clear Data-এ হারায় [RF Official]; Keystore ডিভাইস-বাউন্ড।
- **বিকল্প:** (ক) শুধু Internal+DocumentsProvider; (খ) Android Auto Backup (২৫ MB, Keystore-বাধা) ; (গ) **L1+L2 Mirror+L3 Passphrase-Encrypted Backup**; (ঘ) নিজস্ব Cloud (Scope-বহির্ভূত)।
- **সিদ্ধান্ত:** (গ); Auto Backup বন্ধ রাখা (ঐচ্ছিক Non-secret পরে)।
- **প্রমাণ:** Official Docs [RF]; KDF সুপারিশ OWASP [RF Secondary]; Cross-device ও Interrupted Backup **অপরীক্ষিত** [PoF-B2/B3]।
- **সুবিধা/অসুবিধা:** + ব্যবহারকারী-নিয়ন্ত্রিত, Portable; − ব্যবহারকারীর দায় (Passphrase হারালে অপুনরুদ্ধারযোগ্য), Backup-অভ্যাস লাগে।
- **Security:** AEAD Chunk, AAD-বাউন্ড, Tamper/Truncate-সনাক্ত; Secret বাদ।
- **Failure:** Interruption ⇒ `.part`; Wrong-key ⇒ Header-MAC-ব্যর্থ, ডেটা অক্ষত।
- **Migration:** `formatVersion`+KDF-id Header-এ; পুরোনো Backup পড়া সর্বদা সমর্থিত।

### ADR-013: Capability-Brokered `addWebMessageListener` Bridge — **Proposed** (PoF-W2/W3)
- **Context:** Legacy `addJavascriptInterface` সব Frame-এ উন্মুক্ত; Official Doc ঝুঁকি স্বীকার করে [VF ২.৭]।
- **বিকল্প:** (ক) Legacy রাখা+URL-চেক (বর্তমান); (খ) **`addWebMessageListener` + `isMainFrame` + Broker**; (গ) `postWebMessage`; (ঘ) Bridge বাদ (কার্যকারিতা ভাঙবে)।
- **সিদ্ধান্ত:** (খ), Dual-Stack Migration; Feature-অসমর্থিত ⇒ Degraded Read-only।
- **প্রমাণ:** Official Recommendation [VF]; Preview-Iframe-Origin **অজানা** [PoF-W2]; WebView ≥৮২ [VF]।
- **সুবিধা/অসুবিধা:** + Origin-Allowlist, Frame-তথ্য; − Async API Refactor, পুরোনো WebView-এ অক্ষম।
- **Security:** Page-Script Message নকল করতে পারে — তাই Native Consent/Scope/Audit অপরিহার্য (১৩.৪)।
- **Failure:** Feature-অনুপস্থিতি ⇒ Degraded; Bug-এ Capability-Leak ⇒ Malicious-Iframe Regression Test।
- **Migration:** Legacy Method-ভিত্তিক ধাপে-ধাপে বিলুপ্তি।

### ADR-014: Model Capability Registry ও `APH/1` Protocol — **Proposed**
- **Context:** সব মডেল সমান নয়; Text-Tag/Structured Tool ভিন্ন; `<AP:>`/`<APH:>` মিশ্রণ [VF]।
- **বিকল্প:** (ক) সব মডেলে একই Protocol; (খ) Hard-coded Model-List; (গ) **Measured Registry + Trust Tier + Versioned Protocol**।
- **সিদ্ধান্ত:** (গ)।
- **প্রমাণ:** Arena Catalog শুধু Modality দেয় [VF Fetch]; Tool/Agentic ক্ষমতা অপরিমাপিত [UA→PoF-M1…M6]।
- **সুবিধা/অসুবিধা:** + সীমার বাইরে মডেল চাপানো এড়ানো; − Probe-খরচ ও পুনঃপরিমাপ-দায়।
- **Security:** Validator/Idempotency/Taint-Escalation (৫.৪.৪, ১৩.৬)।
- **Failure:** Registry ভুল ⇒ Tier-Downgrade Fallback; UNMEASURED⇒T1।
- **Migration:** `harnessVersion` Key; Protocol `APH/2` সহাবস্থান।

---

## পরিশিষ্ট A — Proof of Feasibility (PoF) ক্যাটালগ (Revision R1)

> **অবস্থা সততার সাথে:** নিচের **কোনো Arena-PoF (S1–S12) R1-এ সম্পন্ন হয়নি** — Authenticated Arena Session ও Android Device প্রয়োজন, যা এই Revision-এর পরিবেশে ছিল না। এগুলো **Planned**। একমাত্র আংশিক-সম্পন্ন: **PoF-G1 (GitHub Read-only, ২০২৬-১১-১৮)**।

### A.০ সব PoF-এর সাধারণ নিয়ম
Environment রেকর্ড (Arena Account-টাইপ, Model-নাম/Version, তারিখ-সময়, Session-URL, WebView/Chrome Version, ডিভাইস/API); Raw Trace (Network Stream, DOM Snapshot, Command Output) Redacted-অবস্থায় সংরক্ষণ; প্রতি পরীক্ষা ≥ ২০ রান × ≥ ৩ মডেল (বিভিন্ন Provider) যেখানে প্রযোজ্য; ফলাফল `Passed / Partial / Failed`; Arena UI/Stream পরিবর্তনে পুনরায় চালানো। PoF-র Observation-পদ্ধতি: Debug-Build WebView-তে `WebView.setWebContentsDebuggingEnabled(true)` + Desktop Chrome `chrome://inspect` (Network/Elements); Release-এ নয়।

### A.১ Official Direct Code Sandbox PoF (`https://arena.ai/code/direct` — `/code` থেকে আলাদাভাবে)

| ID | উদ্দেশ্য | কীভাবে পরীক্ষা | Success | Failed | অবস্থা |
|---|---|---|---|---|---|
| **S1** `create_file` | মডেলের `create_file`-এ সম্পূর্ণ Path ও Content পাওয়া যায় কি না; Tool Name/Schema/Wire-Format নথিভুক্ত | Known-Content ফাইল (১০ KB, বাংলা Unicode, CRLF/LF, শেষ-Newline, ১০০+ লাইন; এবং > ৬৪ KB) তৈরির Prompt; Stream/DOM Trace; Tier C `sha256sum`-এর সাথে তুলনা | ≥ ৯৯% রানে Path+Content বাইট-নির্ভুল (SHA-256 মিল); Wire-Format Spec লেখা সম্ভব | Tool-Event অনুপস্থিত/Path বা Content Truncate-Redact-Delta-only (পুনর্গঠন অসম্ভব) | **Planned — অসম্পন্ন** |
| **S2** `edit_file` | Edit-পর সম্পূর্ণ নতুন Content শনাক্ত | (ক) Unique-match, (খ) Multi-match, (গ) Whitespace-ভিন্ন, (ঘ) এক Turn-এ একাধিক Edit; Local-Patched Candidate Hash বনাম Tier C Hash | Candidate==Attested ≥ ৯৯%; **অমিল ১০০% ক্ষেত্রে `UNVERIFIED` চিহ্নিত** (নীরব Commit ০) | যেকোনো নীরব অমিল Commit; বা Edit-Event+Tier C দুটোই অপঠনযোগ্য | **Planned** |
| **S3** `delete_file` | Delete নির্ভরযোগ্যভাবে শনাক্ত | ফাইল/Dir মোছা (Tool ও `bash rm -r`), একই Path পুনঃসৃষ্টি; Event বনাম Tier C Manifest | Event ও Manifest-অনুপস্থিতি ১০০% সঙ্গতিপূর্ণ; অসঙ্গতি সর্বদা Flagged | Intent দেখা গেলেও বাস্তব State ভিন্ন, অথচ Unflagged | **Planned** |
| **S4** `bash` Multi-file | এক `bash`-এ একাধিক ফাইল তৈরি/পরিবর্তন Capture | Heredoc দিয়ে ১০ ফাইল, `sed -i` ৫ ফাইল, `cp -r`, `mkdir -p`, Script-জেনারেটেড ফাইল | Tier C Diff **১০০%** পরিবর্তিত Path+Hash তালিকাভুক্ত | কোনো পরিবর্তিত ফাইল Tier C-পরেও অজানা | **Planned** |
| **S5** Shell/Package/Build | Script, Package Install, Build Tool-জনিত পরিবর্তন শনাক্ত ও Cost | `npm install`, `npm run build`, `pip install`, `make`; Ignore-তালিকা (`node_modules`, `.git`, Cache) সহ Tier C; সময়/Token/Output-সীমা পরিমাপ | Source+Lockfile+নির্ধারিত Output Policy অনুযায়ী Capture, নির্ধারিত সময়ে; Tool-Result-দৃশ্যতা ও Truncation-সীমা নথিভুক্ত | Tier C Timeout/Output Truncate-এ Manifest অসম্পূর্ণ ও অশনাক্ত; Ignore অসম্ভব | **Planned** |
| **S6** Editor-এ না-খোলা ফাইল | সব ফাইল সম্পূর্ণ সংগ্রহ সম্ভব কি না; DOM Observer-এর কভারেজ | ৩০ ফাইল তৈরি, কোনোটি Editor-এ না খুলে; DOM কভারেজ % বনাম Tier C Pull | Tier C-তে ১০০% Hash-Verified; DOM কভারেজ পরিমাপিত (অপূর্ণ হলে `PARTIAL` সঠিকভাবে চিহ্নিত) | কোনো উপায়েই অ-খোলা ফাইলের Content সম্পূর্ণ পাওয়া যায় না ⇒ GO-ASSISTED | **Planned** |
| **S7** Binary/Image/Archive/বড় | কীভাবে শনাক্ত ও সংরক্ষণ | PNG (স্ক্রিপ্ট-জেনারেটেড), `tar.gz`, ৫ MB ও ৫০ MB ফাইল; Chunked-base64 Tool-Result Export; Tool-Result আকার-সীমা নির্ণয় | Policy-সীমার ভেতরে Hash-Verified Reassembly; বড় ফাইল `NOT_CAPTURED`+Metadata (Hash/Size) | নীরব Truncation গৃহীত বা Corrupt Reassembly অশনাক্ত | **Planned** |
| **S8** বারবার পরিবর্তন | প্রতিটি গুরুত্বপূর্ণ Version সংরক্ষণ | একই ফাইল ২০ বার (একাধিক Turn) Edit; কোন Tier মধ্যবর্তী Version দেখে তা নথিভুক্ত | প্রতিটি **Observable** Version Hash-Verified ও ক্রমানুসারে; যে মধ্যবর্তী Version Capture অসম্ভব তা স্পষ্ট ঘোষিত (শুধু Checkpoint-Version) | Version ক্রম-ভঙ্গ/হারানো Unflagged | **Planned** |
| **S9** অসম্পূর্ণ/Interrupted/Duplicate Stream | Corrupt ফাইল তৈরি হয় কি না | Fault-Injection: Mid-stream Network Cut, Page Reload, Duplicate Delivery, Out-of-order — ≥ ১০০টি | **Verified Commit-এ Corrupt ফাইল = ০**; Partial/Duplicate সঠিক State-এ | যেকোনো আংশিক Content `VERIFIED`/`COMMITTED` | **Planned** |
| **S10** Background/Renderer Kill/Reload/Reset | সর্বশেষ সংরক্ষিত কাজ উদ্ধারযোগ্য কি না; Arena Session-এর নিজস্ব আচরণ | App Background ≥ ১০ মিনিট; `onRenderProcessGone` (চেষ্টা: `chrome://crash`); Page Reload; Sandbox Idle-expiry (সময় রেকর্ড); `/c/{id}` পুনরায় খোলা — ফাইল/Process State ফেরে কি না | Verified কপি ১০০% অক্ষত ও পুনরুদ্ধারযোগ্য; Arena Reset-আচরণ নথিভুক্ত | Verified ডেটা হারানো/Corrupt | **Planned** |
| **S11** Android→নতুন Sandbox Session Restore | সংরক্ষিত Workspace থেকে ফাইল পুনরুদ্ধার সম্ভব কি না | ২০ Text ফাইল+১ Binary; নতুন `/code/direct` Chat-এ Hydration; Tier C Verify; Composer দৈর্ঘ্য-সীমা পরীক্ষা | ছোট Text-সেটে নির্ধারিত % (Phase 0-এ সংজ্ঞায়িত) Hash-মিল ও **অমিল ১০০% শনাক্ত**; খরচ রেকর্ড | অমিল অশনাক্ত; Composer-সীমা Hydration অসম্ভব করে (তখন Manifest+Pull-only মোড) | **Planned** |
| **S12** Hash Verification | Local ও Sandbox সামঞ্জস্য যাচাই সম্ভব কি না | উপরের সব Test-এ Local SHA-256 বনাম Sandbox `sha256sum` (অনুপস্থিত হলে `openssl dgst`/`python`/`node`); Line-ending/Encoding/Trailing-newline Pitfall | সব `VERIFIED`-এ ১০০% মিল; Hash-টুল Sandbox-এ উপলব্ধ | Sandbox-এ কোনো Hash-টুল নেই বা Output অপঠনযোগ্য ⇒ Attestation অসম্ভব ⇒ GO-ASSISTED | **Planned** |

### A.২ অন্যান্য PoF (সংক্ষিপ্ত)

| ID | উদ্দেশ্য | পদ্ধতি | Pass | Fail | অবস্থা |
|---|---|---|---|---|---|
| **G1** | Tree/Blob Read, Header | Read-only Recursive Tree+বড় Blob+Header | Shape, `truncated`, Blob-SHA ও Header যাচাই | — | **✔ আংশিক সম্পন্ন ২০২৬-১১-১৮** (৭.৫.১); `truncated=true` অপরীক্ষিত |
| G2 | `truncated=true` Subtree Recovery | >১০০,০০০ Entry/৭MB Repo-তে Recovery Algorithm | সব Entry পুনরুদ্ধার ও `treeComplete` সঠিক; Rate-খরচ নথিভুক্ত | Entry হারানো/অশনাক্ত | Planned |
| G3 | Multi-file Atomic Commit (Scratch Repo): REST বনাম GraphQL | Blob→Tree(`sha:null` Delete, Mode)→Commit→Ref | Head==Commit, Tree-Diff প্রত্যাশিত, Rename/Delete/Exec-bit সঠিক | অংশত Applied State | Planned |
| G4 | Branch Race/Non-FF | দ্বিতীয় Client দিয়ে Head সরানো | 422-এ থামা, কোনো Overwrite নয় | Force/Overwrite | Planned |
| G5 | Actions Dispatch+Artifact+Log | `workflow_dispatch`, Run Poll, Artifact/Log Redirect (Auth-Header ফরোয়ার্ড নয়) | Artifact Hash-মিল, Zip-guard | Auth-Leak/Zip-slip | Planned |
| G6 | Secondary Rate-limit/ETag/Search-limit | নিয়ন্ত্রিত বার্স্ট | `retry-after` সম্মান; 304 Rate-খরচ নথিভুক্ত | Ban/অশনাক্ত Throttle | Planned |
| G7 | Device Flow সম্ভাব্যতা | Test OAuth/GitHub App | Token-মেয়াদ/Scope নথিভুক্ত | অসম্ভব/অগ্রহণযোগ্য | Planned |
| D1 | Clear Data-এ Keystore Key/Vault | Real Device, ≥ ২ OEM | আচরণ নথিভুক্ত; Crash নয় | Crash/Token-Leak | Planned |
| D2 | Uninstall→Reinstall: L2 ফাইল ও Grant; Provider ডেটা-টিকে-থাকা নয় তা প্রমাণ | Real Device | L2 টিকে, Grant পুনঃ-Pick লাগে, L1 হারায় | L1 টিকে থাকলে (অপ্রত্যাশিত) নথিভুক্ত | Planned |
| D3 | Clear Data-এ SAF Grant | Real Device | নথিভুক্ত | — | Planned |
| D4 | Grant-সীমা (৫১২?), Folder মোছা/সরানো | Android 10/11/14 | সীমা নির্ণীত; `MISSING/DETACHED` সঠিক; Deletion-Propagation ০ | অনুপস্থিতিকে Delete গণ্য | Planned |
| D5 | দুই-স্থানে Edit Conflict | Mirror+L1 | `CONFLICT` সঠিক, Data-Loss ০ | Overwrite | Planned |
| D6 | v2.4.0→V3 Upgrade (বাস্তব APK/ডেটা) | Real Upgrade | ১০০% Count+Hash মিল | ডেটা-ক্ষতি | Planned |
| D7 | Provider: অন্য App ব্যবহার, ১০k-ফাইল Tree Perf | Files অ্যাপ+২ Editor | Read/Write+Conflict ঠিক | Path-Traversal/Crash | Planned |
| B1 | KDF: Argon2id Library বনাম PBKDF2 | Benchmark (Low/Mid), আকার/Licence/Maintenance | ≈ ৫০০ms–১s; গ্রহণযোগ্য আকার/Licence | অগ্রহণযোগ্য ⇒ PBKDF2 | Planned |
| B2 | Cross-device Restore | Device A→B | Hash ১০০% | অমিল | Planned |
| B3 | Interrupted Backup | Kill মাঝপথে | ভালো Backup অক্ষত; অসম্পূর্ণ প্রত্যাখ্যাত | Overwrite/Silent-accept | Planned |
| B4 | বড় (≥২ GB) Backup/Restore | Low-RAM Device | OOM নয় | OOM/Corrupt | Planned |
| B5 | Auto Backup `dataExtractionRules` Dry-run | `bmgr` | Vault বাদ নিশ্চিত | Secret অন্তর্ভুক্ত | Planned |
| W1 | Bridge Inventory/Dual-Stack | Code-audit+Test | সব Method বর্গীকৃত | অবর্গীকৃত | Planned |
| W2 | Arena Preview-Iframe Origin/Frame | Malicious-Iframe+বাস্তব Preview | Iframe-এ Bridge অনুপস্থিত | Bridge পৌঁছায় | Planned |
| W3 | `addWebMessageListener` Feature-Matrix | WebView ৮২+/OEM | নথিভুক্ত Degraded-পথ | Silent Fallback | Planned |
| W4 | Prompt-Injection Corpus | Web/GitHub/MCP/Doc | Consent ছাড়া সংবেদনশীল Side-effect ০ | ≥১ | Planned |
| W5 | SSRF Corpus | Redirect/Rebind/IPv6 | ১০০% ব্লক | বাইপাস | Planned |
| W6 | Visualizer Sandbox Escape | Test Payloads | Escape ০ | Escape | Planned |
| K1–K3 | Vault Invalidation / Credential Migration Crash / Log-Leak Scan | Instrumented | Token-হারানো/Leak ০ | ≥১ | Planned |
| M1–M6 | Model Identity, Probe Suite, Context-Calibration, Repository Task Suite, Stop, Matrix | বাস্তব Arena Session, ≥ ৩ মডেল | ৫.৪.১১ Tier-Criteria | — | Planned |
| P1–P6 | PDF/OCR/Office/ZIP/Perf/Image-Decode | Corpus+Devices | ১০.৪.৪ | — | Planned |
| F1 | FTS বাংলা/Code Tokenizer Recall | Query-Corpus | Recall ≥ থ্রেশহোল্ড | Word-Fragmentation | Planned |
| F2 | Power-cut/Crash Durability | Kill-test | Journal-Recovery সফল | Corrupt | Planned |

---

## পরিশিষ্ট B — Source ও Evidence তালিকা (Access Date: ২০২৬-১১-১৮)

**শ্রেণি:** `Official` = প্রতিষ্ঠানের নিজস্ব Documentation/পেজ · `Secondary` = Blog/Q&A/তৃতীয়-পক্ষ (Official নয়) · `Repo` = এই Repository-র কোড · `Live` = বাস্তবে চালানো পরীক্ষা।

| # | শিরোনাম | URL | শ্রেণি | ব্যবহার | মন্তব্য |
|---|---|---|---|---|---|
| 1 | AndroidX — Security (Release Notes) | https://developer.android.com/jetpack/androidx/releases/security | Official | `security-crypto` Deprecated; 1.1.0 স্থিতিশীল ২০২৫-০৭-৩০ | সম্পূর্ণ পাঠ |
| 2 | Access native APIs with JavaScript bridge | https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge | Official | `addWebMessageListener` Recommended; `addJavascriptInterface` সীমা; WebView ৮২ | Search-Excerpt (Official পেজ) |
| 3 | PdfRenderer.Page (API reference) | https://developer.android.com/reference/android/graphics/pdf/PdfRenderer.Page | Official | Text/Search API "Added in API level 35" | Search-Excerpt |
| 4 | PageSelection (API reference) | https://developer.android.com/reference/android/graphics/pdf/models/selection/PageSelection | Official | "Also in S Extensions 13" | Search-Excerpt |
| 5 | Access app-specific files | https://developer.android.com/training/data-storage/app-specific | Official | Uninstall-এ App-specific Storage মোছে | Search-Excerpt |
| 6 | Android storage use cases and best practices | https://developer.android.com/training/data-storage/use-cases | Official | Internal Storage প্রাইভেসি/এনক্রিপশন (API 29+) | Search-Excerpt |
| 7 | Data backup overview | https://developer.android.com/identity/data/backup | Official | Auto Backup ২৫ MB; ALB উল্লেখ | Search-Excerpt |
| 8 | Auto Backup for Apps made simple (Android Developers Blog, ২০১৫) | https://android-developers.googleblog.com/2015/07/auto-backup-for-apps-made-simple.html | Official (পুরোনো Blog) | Exclude-Dir, Restore-Timing | বর্তমান অবস্থা #7 দিয়ে মিলিয়ে |
| 9 | Document provider guide | https://developer.android.com/guide/topics/providers/document-provider | Official | Provider/SAF ধারণা | V3 Draft থেকে উত্তরাধিকার; R1-এ Re-fetch হয়নি |
| 10 | REST API endpoints for Git trees | https://docs.github.com/en/enterprise-cloud@latest/rest/git/trees | Official | ১০০,০০০ Entry/৭ MB; `truncated` | Search-Excerpt; Live-পরীক্ষায় সমর্থিত |
| 11 | REST API endpoints for Git blobs | https://docs.github.com/en/rest/git/blobs | Official | ১০০ MB; base64/raw Media Type | Search-Excerpt; Live-পরীক্ষায় সমর্থিত |
| 12 | The Next Stage of AI Coding Evaluation Is Here (Arena Blog; Search-Index তারিখ ২০২৬-০৬-১৫) | https://arena.ai/blog/code-arena | Official | Agentic Tool-Call, Persistent Sessions | Search-Excerpt; `web_fetch`-এ শুধু Title |
| 13 | Build, Deploy, and Evaluate with Fullstack Code Arena (Arena Blog) | https://arena.ai/blog/fullstack-code-arena | Official | শুধু অস্তিত্ব/Title নিশ্চিত | **মূল পাঠ পাওয়া যায়নি** |
| 14 | Arena — `/code/direct` পেজ | https://arena.ai/code/direct | Official (Live Fetch) | Route/Catalog/Feature-Flag পর্যবেক্ষণ | Unauthenticated HTML |
| 15 | Arena.ai's Code Arena Now Builds and Ships Real Fullstack Apps (AlphaSignal) | https://alphasignal.ai/news/arena-ai-s-code-arena-now-builds-and-ships-real-fullstack-apps | **Secondary** | Fullstack-আপডেট/R2-Snapshot দাবি | **Official নয়; [UA]** |
| 16 | Code Arena Review (stork.ai) | https://www.stork.ai/en/code-arena | **Secondary** | সারাংশ | Official নয় |
| 17 | A Field Guide to Android's PDF Rendering APIs (Medium) | https://medium.com/@lucf15/a-field-guide-to-androids-pdf-rendering-apis-what-you-get-on-each-version-and-what-to-call-5095479975ae | **Secondary** | PdfRendererPreV/Extension ১৩ | Official নয় |
| 18 | gmi-software/react-native-better-pdf PR #57 | https://github.com/gmi-software/react-native-better-pdf/pull/57 | **Secondary** | Ext-13 Emulator-সীমা | তৃতীয়-পক্ষ |
| 19 | Persistent Folder Access in Capacitor Apps (Capawesome) | https://capawesome.io/blog/capacitor-persistent-folder-access/ | **Secondary** | SAF Grant-সীমা (AOSP-উদ্ধৃত) | Official Doc-এ সংখ্যা নেই → PoF-D4 |
| 20 | Stack Overflow — takePersistableUriPermission (প্রশ্ন ৭২৭৯৫৭৯৩) | https://stackoverflow.com/questions/72795793 | **Secondary** | Grant-সীমা ১২৮→৫১২ | Official নয় |
| 21 | GitHub API Rate Limits (তৃতীয়-পক্ষ সংকলন: throttle.com; MicrosoftDocs Dev Proxy) | https://throttle.com/api-limits/github/ ; https://github.com/MicrosoftDocs/microsoft-cloud/blob/main/docs/dev/dev-proxy/concepts/github-api-rate-limit-exceeded.md | **Secondary** | Secondary-Limit সংখ্যা | Official Rate-limit পেজ → PoF-G6-এ Re-fetch |
| 22 | Password Storage (OWASP Cheat Sheet-এর Mirror/সারাংশ) | https://deepwiki.com/OWASP/CheatSheetSeries/2.1-password-storage-and-authentication | **Secondary** | Argon2id/PBKDF2 প্যারামিটার | মূল `cheatsheetseries.owasp.org` R1-এ ফেচ হয়নি → PoF-B1 |
| 23 | Repo কোড: `injected.js:600-629`, `sd-site.js:110-122,197,241,423,447`, `MainFrameTracker.kt`, `MainActivity.kt:687`, `build.gradle.kts`, `AndroidManifest.xml:48` | `https://github.com/themuhammad-personal/Arenapilot` @ `0d68014` | Repo | Audit তথ্য | সরাসরি পাঠ |
| 24 | GitHub REST API Live Read-only পরীক্ষা (Trees/Blobs/Headers) | `api.github.com/repos/themuhammad-personal/Arenapilot/…` | Live | ৭.৫.১ | ২০২৬-১১-১৮; কোনো Write নয় |

**যা R1-এ Fetch/যাচাই হয়নি (সততার তালিকা):** MCP Specification সংস্করণ-দাবি; Android Keystore Clear-Data আচরণ; SQLite `unicode61`-এর বাংলা-Combining-Mark আচরণ; GraphQL `createCommitOnBranch` তুলনা; GitHub Device Flow/App-Token Official Doc; ML Kit/Tesseract Bengali-সমর্থন; Arena-র ToS। এগুলো যথাস্থানে `[UA]`/`[PoF]`।

---

## পরিশিষ্ট C — Revision R1 Change Log (Section-ভিত্তিক)

| Section | পরিবর্তন |
|---|---|
| শিরোনাম/Status | Status "Ready for Implementation"→"Revised Draft — PoF Gate Pending" |
| §০ (নতুন) | Evidence Legend, Revision Summary, সততার তালিকা |
| §১.৪ (নতুন) | Repo-যাচাইকৃত অডিট সংযোজন |
| §২ | পুনর্লিখিত — Evidence-ট্যাগ, `/code` বনাম `/code/direct`, Security/PDF/Bridge/Backup Research |
| §৪.৩ (নতুন) | Diagram Errata, Capability Broker, Storage-Layers ভিউ |
| §৫.৩B, §৫.৪ (নতুন) | Code Mode Tool-তালিকা [UA]; Model Compatibility Architecture |
| §৬ | Banner + ৬.৩–৬.১০ (অনুমান-অডিট, Tiered Capture, Ingest, Conflict, Hydration, Responsibility, Fallback, Go/No-Go) |
| §৭.৫ (নতুন) | GitHub Live-PoF, সীমাবদ্ধতা, Auth, Feature-Branch Policy |
| §৮.৫–৮.১০ (নতুন) | Storage Layers, Failure Matrix, Source-of-Truth, Provider/SAF সীমা, Portable Backup |
| §৯ | Errata নোট (Schema-সংগতি) |
| §১০.৪ (নতুন) | Parser Capability, Library, Fallback |
| §১২.৩–১২.৫ (নতুন) | Schema Errata+Normative DDL, FTS, Transactions, Lifecycle, Migration |
| §১৩ | পুনর্লিখিত — Threat Model, Keystore Vault, Bridge, Capability Matrix, Injection, Audit |
| §১৪.৩, §১৬.৩ (নতুন) | Sync/Backup Recovery; Evidence-ভিত্তিক "Done" |
| §১৭ | Claim→Hypothesis; পরিমাপ-পরিকল্পনা |
| §১৮ | Phase 0 (PoF) যোগ; Phase 1–8 পুনর্বিন্যাস |
| §১৯ | R1 ঝুঁকি/অমীমাংসিত প্রশ্ন যোগ |
| §২০ | ADR পুনর্মূল্যায়ন: Status, বিকল্প, Failure, Migration; ADR-009 Rejected; ADR-011…014 নতুন |
| পরিশিষ্ট A/B/C | PoF ক্যাটালগ; Source তালিকা; Change Log |

*End of ArenaPilot V3 Architecture & Product Specification — Revision R1.*
