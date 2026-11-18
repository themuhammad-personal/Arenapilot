# ArenaPilot V3 — Architecture & Product Specification
**পূর্ণাঙ্গ কারিগরি ব্লুপ্রিন্ট, কোডবেস অডিট এবং প্রোডাক্ট স্পেসিফিকেশন (Technical & Product Blueprint)**

- **Project:** ArenaPilot (`com.arenadeck.app`)
- **Repository:** `https://github.com/themuhammad-personal/Arenapilot`
- **Audited Baseline:** `v2.4.0` (`main` @ `80b9f0a`, `stabilize/v2.1.0` @ `c1270be`)
- **Target Architecture:** `ArenaPilot V3.0`
- **Date:** November 18, 2026
- **Status:** Canonical V3 Engineering & Product Specification (Ready for Phased Implementation)

---

## সূচিপত্র (Table of Contents)

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
20. [Architecture Decision Records (ADR-001 থেকে ADR-010)](#20-architecture-decision-records-adr-001-থেকে-adr-010)

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

---

## 2. অনলাইন গবেষণা ও বহিরাগত প্রযুক্তির সক্ষমতা যাচাই (Online Research & Evidence)

অনুমানের পরিবর্তে প্রাথমিক ও অফিসিয়াল উৎস থেকে যাচাইকৃত তথ্যের ভিত্তিতে V3-এর আর্কিটেকচারাল সিদ্ধান্তগুলো গৃহীত হয়েছে:

### ২.১ Arena.ai Direct Mode ও Official Code Sandbox-এর প্রকৃত সক্ষমতা ও সীমাবদ্ধতা
- **উৎস ও প্রমাণ:**
  1. *Arena.ai Official Blog — "The Next Stage of AI Coding Evaluation Is Here (Code Arena)"* (`https://arena.ai/blog/code-arena`, June 2026)
  2. *Arena.ai Official Blog — "Build, Deploy, and Evaluate with Fullstack Code Arena"* (`https://arena.ai/blog/fullstack-code-arena`, July 2026)
  3. *Arena.ai Network & Route Verification* (`sd-site.js`, `scripts/fetch-models.mjs`, `GET https://arena.ai/nextjs-api/model-catalog`)
- **যাচাইকৃত বাস্তবতা (Verified Technical Facts):**
  - **চারটি Direct Mode রুট:** `arena.ai` চারটি Direct Mode হোম রুট পরিবেশন করে: `/text/direct` (`modality: "chat"`), `/code/direct` (`modality: "webdev"`), `/search/direct` (`modality: "search"`), এবং `/image/direct` (`modality: "image"`)। কথোপকথন শুরু হলে URL পরিবর্তিত হয়ে `/c/{evaluationId}` হয়।
  - **API ও স্ট্রিম প্রোটোকল:** প্রথম টার্নে `POST /nextjs-api/stream/create-evaluation` এবং পরবর্তী টার্নে `POST /nextjs-api/stream/post-to-evaluation/{id}` কল হয়। রিকোয়েস্ট বডিতে `recaptchaV3Token` থাকে যা কেবল পেজের নিজস্ব স্ক্রিপ্ট তৈরি করতে পারে। রেসপন্স একটি লাইন-ভিত্তিক স্ট্রিম (`a0:"text"`, `ag:"reasoning"`, `a3:"error"`, `ad:{"finishReason":...,"usage":...}`)।
  - **Arena Official Code Sandbox কীভাবে কাজ করে:**
    Arena-এর Code Mode (`/code/direct` / Fullstack Code Arena)-এ নির্বাচিত মডেল একটি **Cloud-Hosted Isolated Sandbox Environment**-এ এজেন্ট হিসেবে কাজ করে। সেখানে মডেলের জন্য বিল্ট-ইন টুল (`bash` / `run_command`, `create_file`, `edit_file`, `read_file`, `delete_file`, `list_files`, `glob_files`, `grep_files`, `web_search`, `web_fetch`, ভিজ্যুয়াল টার্মিনাল, লাইভ ডেভ সার্ভার ও প্রিভিউ এবং CodeMirror 6 সোর্স ভিউয়ার) থাকে।
  - **মৌলিক সীমাবদ্ধতা (Critical Boundary Constraint):**
    1. **অফিসিয়াল Sandbox Android ডিভাইসের ভেতরে চলে না; এটি Arena.ai-এর ক্লাউড কন্টেইনারে চলে।** ফলে অফিসিয়াল Sandbox থেকে সরাসরি Android-এর স্থানীয় ফাইল সিস্টেম (`/data/data/...` বা `/storage/emulated/0/...`)-এ POSIX ফাইল কমান্ড দিয়ে প্রবেশ করা **প্রযুক্তিগতভাবে অসম্ভব**।
    2. **অস্থায়ীত্ব (Ephemerality):** ক্লাউড স্যান্ডবক্সের কন্টেইনার নির্দিষ্ট সময় নিষ্ক্রিয় থাকলে বা সেশন রিসেট হলে এর রানিং প্রসেস ও আন-স্ন্যাপশটেড লোকাল স্টেট হারিয়ে যায়।
    3. **সমাধান:** Android Native Layer এবং Arena Official Sandbox-এর মধ্যে সিঙ্ক্রোনাইজেশনের একমাত্র বাস্তবসম্মত ও নির্ভরযোগ্য পথ হলো **WebView Stream/DOM Artifact Interception + Composer Workspace Hydration + GitHub Cloud-to-Device Bridge** (বিস্তারিত সেকশন ৬-এ)।

### ২.২ Android Native Storage ও File Access API (API 26–35)
- **উৎস:** *Android Developers Official Guide — Storage Access Framework & Custom Document Provider* (`https://developer.android.com/guide/topics/providers/document-provider`)।
- **যাচাইকৃত সিদ্ধান্ত:**
  - অ্যাপের নিজস্ব অভ্যন্তরীণ ফাস্ট স্টোরেজ (`context.filesDir/workspaces/`) কোনো রানটাইম পারমিশন ছাড়াই সর্বোচ্চ গতিতে POSIX ফাইল অপারেশন, SQLite/Room ডাটাবেস ও অ্যাটমিক ফাইল রাইট সমর্থন করে।
  - এই অভ্যন্তরীণ স্টোরেজকে ব্যবহারকারীর কাছে এবং অন্যান্য অ্যান্ড্রয়েড অ্যাপের (যেমন সিস্টেম Files অ্যাপ, কোড এডিটর) কাছে উন্মুক্ত করার জন্য Android-এর স্ট্যান্ডার্ড **`DocumentsProvider` (`android.provider.DocumentsProvider`)** ব্যবহার করা হবে। এতে `MANAGE_EXTERNAL_STORAGE` (যা Google Play ও Android 11+ নিরাপত্তা নীতির পরিপন্থী) ছাড়াই পূর্ণাঙ্গ নেটিভ ফাইল অ্যাক্সেস পাওয়া যায়।
  - ব্যবহারকারীর ডিভাইসের যেকোনো বাহ্যিক ফোল্ডারের সাথে সিঙ্ক করার জন্য `Intent.ACTION_OPEN_DOCUMENT_TREE` + `contentResolver.takePersistableUriPermission(uri, FLAG_GRANT_READ_URI_PERMISSION or FLAG_GRANT_WRITE_URI_PERMISSION)` ব্যবহৃত হবে।

### ২.৩ GitHub REST API v3 (Git Data API) ও Actions API
- **উৎস:** *GitHub Official REST API Documentation — Git Trees, Git Blobs, Git Commits, Git References* (`https://docs.github.com/en/rest/git/trees`, `https://docs.github.com/en/rest/git/commits`)।
- **যাচাইকৃত সিদ্ধান্ত:**
  - ডিভাইসে কোনো লোকাল `git` বাইনারি বা ৬৪ মেগাবাইটের ZIP ডাউনলোড ছাড়াই GitHub-এর **Git Data API** ব্যবহার করে:
    1. `GET /repos/{owner}/{repo}/git/trees/{branch_sha}?recursive=1` দিয়ে ১টি HTTP কলে পুরো রিপোজিটরির সম্পূর্ণ ফাইল ট্রি ও SHA পাওয়া যায়।
    2. কেবল প্রয়োজনীয় ফাইল `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` বা Blob SHA দিয়ে অন-ডিমান্ড পড়া যায়।
    3. একাধিক ফাইলের পরিবর্তন একসঙ্গে অ্যাটমিক কমিট ও পুশ করতে `POST /git/blobs` → `POST /git/trees` (`base_tree` সহ) → `POST /git/commits` → `PATCH /git/refs/heads/{branch}` ব্যবহৃত হবে।

### ২.৪ Model Context Protocol (MCP) 2025–2026 Specification
- **উৎস:** *Model Context Protocol Official Specification (`2025-03-26` & `2026-07-28` Streamable HTTP Transport)* (`https://modelcontextprotocol.io/specification/2025-03-26/basic/transports`, `https://modelcontextprotocol.io/specification/2026-07-28/changelog`)।
- **যাচাইকৃত সিদ্ধান্ত:**
  - V3 MCP ক্লায়েন্ট একইসঙ্গে **Stateful Streamable HTTP (`2025-03-26` / `2025-11-25`)** (`initialize` হ্যান্ডশেক ও `Mcp-Session-Id` হেডার, HTTP 404 হলে অটো রিকানেক্ট ও `DELETE` সেশন টার্মিনেশন) এবং **Stateless Streamable HTTP (`2026-07-28`, SEP-2567 / SEP-2243)** (`Mcp-Method`, `Mcp-Name` হেডার ও `_meta` প্রোটোকল ভার্সন) উভয়ই সমর্থন করবে।

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

---

## 6. Code Mode (সর্বোচ্চ অগ্রাধিকার): Official Sandbox ও Persistent Storage সমন্বয়

### ৬.১ বাধ্যবাধকতা ও মৌলিক সমস্যা বিশ্লেষণ
- **বাধ্যবাধকতা:** Arena.ai-এর Code Mode-এ বিদ্যমান **Official Cloud Sandbox**-ই হবে একমাত্র কোড এক্সিকিউশন পরিবেশ। অ্যাপের ভেতরের পুরোনো লোকাল PRoot/Alpine Linux স্যান্ডবক্স (`Sandbox.kt`, `SandboxTools.kt`, `libproot.so`, `StudioActivity.kt`) কোড এক্সিকিউশনের জন্য আর ব্যবহৃত হবে না।
- **মৌলিক সমস্যা:**
  1. অফিসিয়াল স্যান্ডবক্স Arena.ai-এর ক্লাউড সার্ভারে চলে, তাই সেটি সরাসরি Android-এর লোকাল ফাইল সিস্টেমে প্রবেশ করতে পারে না।
  2. অফিসিয়াল স্যান্ডবক্সের সেশন এক্সপায়ার বা রিসেট হলে ক্লাউড কন্টেইনারের ভেতরে তৈরি করা ফাইল ও কাজের অগ্রগতি হারিয়ে যেতে পারে।
  3. ব্যবহারকারী যখন নতুন সেশনে বা রিসেট হওয়া স্যান্ডবক্সে কাজ শুরু করে, তখন স্থানীয় Android স্টোরেজে থাকা প্রজেক্ট ফাইলগুলো আবার অফিসিয়াল স্যান্ডবক্সে পৌঁছে দেওয়ার ব্যবস্থা থাকতে হবে।

### ৬.২ সমাধান: Tri-Channel Official Sandbox ⇄ Android Persistent Storage Bridge

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

---

## 7. GitHub Agent ও Repository Workflow Specification

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

---

## 13. Security, Privacy ও Data Ownership Architecture

1. **Android Keystore Credential Encryption (`EncryptedCredentialVault`):**
   - GitHub PAT এবং সকল MCP সার্ভারের API Key Android Keystore-এর `MasterKey` (AES-256-GCM) দিয়ে এনক্রিপ্ট করে সংরক্ষিত হবে।
   - এই টোকেনগুলো শুধুমাত্র Kotlin নেটিভ লেয়ারের `GitHubAgentEngine` ও `McpClientEngine` HTTP হেডারে (`Authorization: Bearer ...`) ব্যবহার করবে। WebView-এর JavaScript, DOM বা AI মডেলের প্রম্পটে কখনোই টোকেনের মান পাঠানো হবে না।
2. **Strict Origin & Frame Isolation:**
   - `MainFrameTracker.kt` ও `ChatUrls.kt` নিশ্চিত করবে যে `window.AndroidBridge` শুধুমাত্র টপ-লেভেল HTTPS `arena.ai` ও `www.arena.ai` অরিজিনে কাজ করবে। কোনো তৃতীয় পক্ষের iframe বা বাহ্যিক লিংকে ব্রিজ সম্পূর্ণ নিষ্ক্রিয় (`trustedPage = false`) থাকবে।
3. **SSRF & Local Network Protection (`NetworkGuard.kt`):**
   - মডেল-চালিত যেকোনো URL ফেচ বা MCP কলের ক্ষেত্রে `NetworkGuard.FilteringDns` সকল প্রাইভেট আইপি (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`) ব্লক করবে।
4. **Explicit User Consent Gates (অনুমতি ছাড়া কাজ না করার গ্যারান্টি):**
   - ব্যবহারকারী নিজে ফাইল পিকার বা SAF ফোল্ডার দিয়ে যে ফাইল/ফোল্ডার নির্বাচন করবেন না, অ্যাপ সেই ফাইলে হাত দেবে না।
   - GitHub-এ কোড Push, Branch Delete বা Pull Request তৈরির আগে ডিফল্টভাবে ব্যবহারকারীর কাছে **Diff & Commit Confirmation Sheet** দেখানো হবে।
   - `android:allowBackup="false"` বজায় থাকবে যাতে ক্লাউড বা ADB ব্যাকআপের মাধ্যমে সেশন কুকি বা কী-স্টোর মেটাডেটা বাইরে না যায়।

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

---

## 17. Performance, RAM, Battery ও Storage Requirements

1. **APK আকার ও বিল্ড টাইম হ্রাস:**
   লোকাল PRoot ও Alpine বাইনারি (`libproot.so`, `libtalloc.so`, `fetch_sandbox_deps.py`) সরিয়ে ফেলার ফলে APK-এর আকার প্রায় **৩০–৪০ MB কমে যাবে** এবং CI-তে NDK বিল্ডের সময় সাশ্রয় হবে।
2. **Main-Thread Jank শূন্যে নামানো:**
   সকল ফাইল পার্সিং, SQLite কুয়েরি, স্যান্ডবক্স ফাইল রাইট এবং GitHub API কল শুধুমাত্র ব্যাকগ্রাউন্ড `Dispatchers.IO` / `ioExecutor`-এ চলবে। UI থ্রেডে কোনো ফাইল বা JSON ব্লব সিরিয়ালাইজেশন চলবে না (টার্গেট ফ্রেম টাইম < 16ms)।
3. **RAM ও WebView স্থায়িত্ব:**
   টার্ন হিস্ট্রি ও ফাইল কন্টেন্ট WebView JS হিপ থেকে সরিয়ে নেটিভ Room ডাটাবেস ও স্ট্রিমিং `NativeBlobStore`-এ রাখার ফলে WebView রেন্ডারারের মেমরি ব্যবহার ৫০%+ হ্রাস পাবে এবং Android লো-মেমরি কিল (`reason=12/13`) উল্লেখযোগ্যভাবে কমে যাবে।
4. **ব্যাটারি সুরক্ষা:**
   `TaskForegroundService` শুধুমাত্র তখনই চলবে যখন কোনো এজেন্টিক টাস্ক বা GitHub সিঙ্ক সক্রিয়ভাবে চলছে; কাজ শেষ হওয়ার ৬০ সেকেন্ডের মধ্যে সার্ভিস স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।

---

## 18. Phased Development Roadmap, Dependencies ও Implementation Guide

পরবর্তী পর্যায়ের ইঞ্জিনিয়ার বা AI এজেন্ট যেন কোনো অনুমান ছাড়াই ধাপে ধাপে V3 বাস্তবায়ন করতে পারে, সেজন্য কাজটিকে **৭টি স্বাধীন ও যাচাইযোগ্য ফেজে (Phases)** ভাগ করা হলো:

### Phase 0: Hygiene, Prompt Bug Fixes & Dead Dependency Cleanup (P0 — প্রস্তুতিমূলক ধাপ)
- **কাজ:**
  1. `injected.js`-এ `[OFFICE SKILL]`-এর সাবস্ট্রিং ম্যাচিং (`t.includes(o)`) পরিবর্তন করে শুধুমাত্র স্পষ্ট ডকুমেন্ট তৈরির ইনটেন্ট ও ওয়ার্ড-বাউন্ডারিতে সীমাবদ্ধ করা এবং Code/Search/Image মোডে এটি সম্পূর্ণ বন্ধ করা।
  2. `injected.js` থেকে অপ্রাসঙ্গিক `APH:HARNESS_TASK` ("Deep Code") প্রম্পট ব্লক অপসারণ করা।
  3. `package.json` থেকে অব্যবহৃত ৪৫+ ওয়েব-টেমপ্লেট ডিপেন্ডেন্সি (`@electric-sql/pglite`, `@tanstack/*`, `better-auth`, `pg` ইত্যাদি) পরিষ্কার করে `package-lock.json` হালনাগাদ করা।
- **যাচাই:** `npm test` ও `./gradlew testDebugUnitTest` সবুজ।

### Phase 1: Unified Native Storage, Room Database & Lossless Migration (P0 — ভিত্তি স্তর)
- **কাজ:**
  1. `android/app/build.gradle.kts`-এ Room (`androidx.room:room-runtime`, `room-ktx`, `room-compiler`) এবং `androidx.security:security-crypto` যুক্ত করা।
  2. সেকশন ১২.১ অনুযায়ী `ArenaDatabase` (১০টি টেবিল + FTS4), `WorkspaceFileSystem`, এবং `EncryptedCredentialVault` তৈরি করা।
  3. `LegacyStoreMigrator` তৈরি করে পুরোনো `EngineStore`, প্রজেক্ট, মেমরি এবং পুরোনো লোকাল স্যান্ডবক্সের ফাইলগুলো নতুন ওয়ার্কস্পেসে মাইগ্রেট করা।
  4. `ArenaWorkspaceDocumentsProvider` যুক্ত করে Android Files অ্যাপের সাথে সমন্বয় করা।
- **যাচাই:** `ArenaDatabaseMigrationTest` ও `WorkspaceFileSystemTest` পাস।

### Phase 2: Code Mode Overhaul & Official Sandbox Sync Engine (P0 — সর্বোচ্চ অগ্রাধিকার)
- **কাজ:**
  1. `OfficialSandboxSyncEngine.kt` এবং `ap-stream-hook.js` + `ap-sandbox-observer.js` তৈরি করা, যা Arena-এর Official Code Sandbox-এর প্রতিটি ফাইল তৈরি/এডিট/ডিলিট এবং কমান্ড আউটপুট রিয়েল-টাইমে ক্যাপচার করে `filesDir/workspaces/<projectId>/tree/` ও `sandbox_snapshots`-এ সংরক্ষণ করবে।
  2. Workspace Hydration Protocol (`<AP:WORKSPACE_HYDRATION>` ও `<AP:LOCAL_FILE_READ>`) তৈরি করা যাতে স্যান্ডবক্স রিসেট হলেও সংরক্ষিত ফাইলগুলো নতুন সেশনে সাথে সাথে পুনরুদ্ধার করা যায়।
  3. `sd-site.js`-এর Code Mode প্রম্পট হালনাগাদ করে Arena-এর Official Sandbox টুলগুলোকে একমাত্র এক্সিকিউশন পরিবেশ হিসেবে ঘোষণা করা এবং পুরোনো লোকাল PRoot স্যান্ডবক্স (`Sandbox.kt`, `StudioActivity.kt`, `fetch_sandbox_deps.py`) অবলোপন করা।
- **যাচাই:** `OfficialSandboxSyncEngineTest`, হারনেস টেস্ট ও ইমুলেটর স্মোক টেস্ট পাস।

### Phase 3: Native GitHub Agent Engine & Repository Workflow (P0 — Code Mode Core)
- **কাজ:**
  1. `GitHubAgentEngine.kt` তৈরি করা: Fine-grained PAT যাচাই (`GET /user`), রিপো ও ব্রাঞ্চ ব্রাউজার, রিকার্সিভ ট্রি ইনডেক্সার (`GET /git/trees/{sha}?recursive=1`), অন-ডিমান্ড ফাইল রিডার, এবং Git Data API দিয়ে অ্যাটমিক মাল্টি-ফাইল কমিট ও পুশ (`blobs` → `trees` → `commits` → `refs`)।
  2. Pull Request তৈরি (`POST /pulls`) এবং GitHub Actions রান স্ট্যাটাস ও লগ ফেচার যুক্ত করা।
  3. নেটিভ **GitHub & Diff Review Sheet** তৈরি করা।
- **যাচাই:** `GitHubAgentEngineTest` (`MockWebServer`-এ সম্পূর্ণ কমিট/পুশ/PR ফ্লো) পাস।

### Phase 4: Multi-Format File Upload & Native Analysis Pipeline (P1)
- **কাজ:**
  1. `FileAnalysisEngine.kt` তৈরি করা: নেটিভভাবে `PDF` (টেক্সট + `PdfRenderer` পেজ ইমেজ), `DOCX` (`word/document.xml`), `XLSX` (`xl/worksheets/sheet*.xml`), `PPTX` (`ppt/slides/slide*.xml`), `CSV`, এবং `ZIP`/`TAR.GZ` পার্স করে স্ট্রাকচার্ড Markdown ও টেবিল তৈরি করা।
  2. বড় ফাইলের জন্য Room FTS4 চ্যাঙ্কিং এবং অন-ডিমান্ড `<AP:READ_UPLOAD>` টুল যুক্ত করা।
  3. Attachment Preview Tray ও ২৪ ঘণ্টার অটো-ক্লিনআপ যুক্ত করা।
- **যাচাই:** `FileAnalysisEngineTest` (আসল PDF/DOCX/XLSX/PPTX/ZIP ফাইল ফিক্সচার দিয়ে) পাস।

### Phase 5: Memory, Projects & Four Direct Modes Completion (P1)
- **কাজ:**
  1. `MemoryEngine.kt` ও `ProjectEngine.kt` সম্পূর্ণ করা (`GLOBAL` বনাম `PROJECT` স্কোপ, প্রজেক্ট আইসোলেশন, `.approject.zip` এক্সপোর্ট/ইমপোর্ট)।
  2. **Search Mode:** নেটিভ Readability আর্টিকেল এক্সট্র্যাক্টর ও **Sources & Citations Sheet** যুক্ত করা।
  3. **Image Mode:** জেনারেটেড ইমেজ অটো-সেভার (`generated_images`), নেটিভ ইমেজ গ্যালারি, প্রম্পট হিস্ট্রি ও MediaStore এক্সপোর্ট যুক্ত করা।
- **যাচাই:** `MemoryAndProjectIsolationTest` এবং ৪টি মোডের এন্ড-টু-এন্ড হারনেস টেস্ট পাস।

### Phase 6: Native Settings UI, MCP 2026 Upgrade & Final Polish (P1)
- **কাজ:**
  1. ৯টি ক্যাটাগরির নেটিভ Settings Sheet তৈরি করা (যাতে GitHub Token, Backup/Restore, Sandbox Sync, Memory, Projects, MCP ও System Doctor সব এক জায়গায় নির্ভরযোগ্যভাবে কাজ করে)।
  2. `McpClientEngine`-কে MCP `2025-11-25` ও `2026-07-28` স্পেক অনুযায়ী আপগ্রেড করা।
  3. সম্পূর্ণ টেস্ট স্যুট ও ইমুলেটর স্মোক টেস্ট চালিয়ে `v3.0.0` রিলিজ প্রকাশ করা।

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

---

## 20. Architecture Decision Records (ADR-001 থেকে ADR-010)

### ADR-001: Decommission On-Device PRoot Linux Sandbox in Favor of Arena Official Sandbox + Native Persistent Storage
- **Context:** v2.4.0-এ অ্যাপের ভেতরে একটি লোকাল PRoot Alpine স্যান্ডবক্স (`Sandbox.kt`, `libproot.so`) ছিল যা APK-কে ৪০ MB বড় করত এবং Code Mode-এ Arena-এর নিজস্ব Official Cloud Sandbox-এর সাথে দ্বন্দ্ব তৈরি করত।
- **Decision:** লোকাল PRoot স্যান্ডবক্স সম্পূর্ণ অপসারণ করা হবে। Code Mode-এ শুধুমাত্র Arena-এর Official Sandbox ব্যবহৃত হবে এবং `OfficialSandboxSyncEngine` এর মাধ্যমে স্যান্ডবক্সের ফাইলগুলো রিয়েল-টাইমে Android-এর নেটিভ স্টোরেজে (`filesDir/workspaces/`) সংরক্ষিত হবে।
- **Consequences:** পণ্যের বাধ্যবাধকতা ১০০% পূরণ হয়, APK আকার ৩০–৪০ MB কমে, এবং ব্যবহারকারী ক্লাউড স্যান্ডবক্সের শক্তির সাথে লোকাল স্টোরেজের স্থায়িত্ব উভয়ই পায়।

### ADR-002: Replace Monolithic JSON Blob Storage (`EngineStore`) with Room SQLite (WAL + FTS4) + Native Workspace Files
- **Context:** প্রজেক্ট ফাইল ও মেমরি একক JSON স্ট্রিং হিসেবে `@JavascriptInterface` দিয়ে পারাপার করায় মেমরি ও পারফরম্যান্স বটলনেক তৈরি হচ্ছিল।
- **Decision:** সমস্ত মেটাডেটা, মেমরি, টার্ন হিস্ট্রি ও চেকপয়েন্ট থাকবে Room SQLite ডাটাবেসে (WAL ও FTS4 সহ), আর প্রজেক্টের আসল ফাইলগুলো থাকবে `filesDir/workspaces/<projectId>/tree/` ফোল্ডারে।
- **Consequences:** ও(১) ফাইল আপডেট, মিলিসেকেন্ডে ফুল-টেক্সট সার্চ, এবং বড় প্রজেক্টেও শূন্য UI ফ্রিজ।

### ADR-003: Expose Internal Workspaces via Custom Android `DocumentsProvider` + SAF Two-Way Sync
- **Context:** Android 11+ Scoped Storage-এ `MANAGE_EXTERNAL_STORAGE` ছাড়া অ্যাপের ফাইল অন্য কোড এডিটরে খোলা বা শেয়ার্ড ফোল্ডারের সাথে সমন্বয় করা কঠিন।
- **Decision:** `ArenaWorkspaceDocumentsProvider` বাস্তবায়ন করা হবে যাতে সিস্টেম Files অ্যাপ ও অন্যান্য অ্যাপ সরাসরি ওয়ার্কস্পেস অ্যাক্সেস করতে পারে, এবং বাহ্যিক ফোল্ডারের জন্য `ACTION_OPEN_DOCUMENT_TREE` (Persistable URI) টু-ওয়ে সিঙ্ক ব্যবহৃত হবে।
- **Consequences:** কোনো বিপজ্জনক পারমিশন ছাড়াই পূর্ণাঙ্গ নেটিভ ফাইল অভিজ্ঞতা।

### ADR-004: Native GitHub Git Data API Engine (`blobs`/`trees`/`commits`/`refs`) Instead of Local `git` Binary
- **Context:** লোকাল PRoot অপসারণের পর ডিভাইসে আলাদা `git` বাইনারি ছাড়া কীভাবে ব্রাঞ্চ, মাল্টি-ফাইল কমিট, পুশ ও PR কাজ করবে?
- **Decision:** Kotlin-এ `GitHubAgentEngine` সরাসরি GitHub REST API v3-এর Git Data এন্ডপয়েন্ট ব্যবহার করে রিকার্সিভ ট্রি ফেচ, অন-ডিমান্ড ফাইল রিড এবং অ্যাটমিক মাল্টি-ফাইল কমিট ও পুশ সম্পন্ন করবে।
- **Consequences:** পুরো রিপোজিটরি ক্লোন না করেও তাৎক্ষণিক ফাইল ব্রাউজিং ও অ্যাটমিক কমিট সম্ভব হয়।

### ADR-005: Native Multi-Format Document Parsing (`FileAnalysisEngine`) to Overcome Arena's Image-Only File Input
- **Context:** Arena.ai-এর `<input type="file">` কেবল ছবি নেয়; ফলে PDF, DOCX, XLSX, PPTX ও ZIP ফাইল আপলোড করা যেত না।
- **Decision:** ছবিগুলো পেজের ফাইল ইনপুটে যাবে, কিন্তু ডকুমেন্ট ও আর্কাইভ ফাইলগুলো Android নেটিভ লেয়ারে পার্স (`PdfRenderer` + PDF টেক্সট + XML/ZIP স্ট্রিমিং পার্সার) করে স্ট্রাকচার্ড Markdown ও চ্যাঙ্ক ইনডেক্স হিসেবে মডেলে সরবরাহ করা হবে।
- **Consequences:** যেকোনো মডেলেই PDF, Word, Excel, PowerPoint ও ZIP ফাইলের নির্ভুল বিশ্লেষণ কাজ করবে।

### ADR-006: Strict Scope Separation Between Global Memory, Project Memory, and Project Workspaces
- **Context:** v2.4.0-এ সব মেমরি একটি গ্লোবাল ম্যাপে মিশে থাকত।
- **Decision:** মেমরিতে `scope` (`GLOBAL` | `PROJECT`) ও `project_id` ফরেন কি যুক্ত করা হবে এবং প্রজেক্ট সুইচ করলে কঠোরভাবে শুধুমাত্র ওই প্রজেক্টের ফাইল ও মেমরি লোড হবে।
- **Consequences:** এক প্রজেক্টের তথ্য অন্য প্রজেক্টে কখনোই দূষণ ঘটাবে না।

### ADR-007: Zero Prompt Contamination Policy in Image Mode (`/image/direct`)
- **Context:** ইমেজ জেনারেশন মডেলে সিস্টেম নির্দেশনা বা মেমরি যুক্ত হলে ছবির প্রম্পট নষ্ট হয়ে যায়।
- **Decision:** `modality === "image"` হলে প্রম্পট ইনজেক্টর হার্ড-বাইপাস করবে (`inject: false, tools: false, memory: false`) এবং কেবল জেনারেটেড ছবি ক্যাপচার করে নেটিভ গ্যালারিতে সংরক্ষণ করবে।
- **Consequences:** ব্যবহারকারীর প্রম্পট ১০০% বিশুদ্ধ থাকে এবং তৈরি হওয়া ছবি কখনোই হারায় না।

### ADR-008: Strangler-Fig De-Minification of `content.js` & Native Settings Sheet
- **Context:** ৩.৩৫ মেগাবাইটের মিনিফাইড `content.js`-এ স্ট্রিং রিপ্লেসমেন্ট করে UI পরিবর্তন করা অত্যন্ত ভঙ্গুর।
- **Decision:** নতুন কোনো ফিচার `content.js`-এ স্ট্রিং-প্যাচ করা হবে না; Settings, GitHub, File Manager, Diff Viewer ও Gallery হবে নেটিভ Android Sheets এবং পেজ অ্যাডাপ্টার হবে আন-মিনিফাইড মডুলার JS (`assets/ap/*.js`)।
- **Consequences:** কোডবেস শতভাগ পঠনযোগ্য, ডিবাগযোগ্য ও দীর্ঘমেয়াদে রক্ষণাবেক্ষণযোগ্য হবে।

### ADR-009: Android Keystore (`EncryptedCredentialVault`) for All Secrets
- **Context:** GitHub PAT ও MCP API Key প্লেইনটেক্সট স্টোরেজে রাখা অনিরাপদ।
- **Decision:** সকল টোকেন AES-256-GCM (`MasterKey`) দিয়ে এনক্রিপ্ট করে রাখা হবে এবং কেবল নেটিভ OkHttp কলের সময় হেডারে যুক্ত হবে।
- **Consequences:** প্রম্পট ইনজেকশন বা XSS হলেও কোনো টোকেন ফাঁস হওয়া অসম্ভব।

### ADR-010: Native Turn Ledger & Task Checkpointing for Crash-Proof Long Tasks
- **Context:** WebView রেন্ডারার কিল হলে বা পেজ রিলোড হলে `sdsArenaRing` মুছে গিয়ে এজেন্টের কাজ থেমে যেত।
- **Decision:** প্রতিটি টার্ন এবং স্যান্ডবক্স চেকপয়েন্ট রিয়েল-টাইমে নেটিভ Room ডাটাবেসে সংরক্ষিত হবে।
- **Consequences:** দীর্ঘমেয়াদি কোডিং বা রিসার্চ টাস্ক যেকোনো ইন্টারাপশনের পর ঠিক শেষ যাচাইকৃত ধাপ থেকে পুনরায় শুরু হতে পারবে।

---
*End of ArenaPilot V3 Architecture & Product Specification.*
