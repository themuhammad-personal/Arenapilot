# PROGRESS — চলমান অবস্থা (এজেন্ট হ্যান্ডঅফ ফাইল)

নতুন চ্যাটে কাজ শুরুর আগে: ১) এই ফাইল ২) `docs/PLAN.md` ৩) `git log --oneline -15` পড়ো। কাজ শেষে এই ফাইল হালনাগাদ করে commit করো।

## শেষ হালনাগাদ: ২০২৬-১১-১৫ · ব্রাঞ্চ `stabilize/v2.1.0` · সংস্করণ 2.4.0

### সম্পন্ন
- v2.2.0 সেটিংস/"+" শিট ছাঁটাই; v2.3.0 Text/Code/Image/Search Direct মোড ইঞ্জিনে যুক্ত।
- v2.4.0: পুরোনো ডক মোছা, `docs/PLAN.md`, এজেন্টিক প্লেবুক (persistence, evidence, plan→act, limit-aware, resume-files, honest finish),
  Code/Search অতিরিক্ত নিয়ম, emulator CI স্থিরতা, README পুনর্লিখন, HTML রিপোর্ট ও সেটআপ গাইড।

### পরীক্ষিত (প্রমাণ)
- Node টেস্ট লোকালি: 415 পাস / 0 ব্যর্থ (cdp ও ci-এর একটি APK-টুল সাবটেস্ট স্যান্ডবক্সে বাদ)।
- GitHub Actions রান `43723441502` (commit 7144651): Build & Verify APK, Emulator smoke (Linux sandbox exec/write/edit/read/pip সব stage ok), Arena adapter, Lint, Harness — সব সবুজ।
- পূর্ণ রিপোর্ট: [REPORT.html](REPORT.html)।

### অমীমাংসিত / সৎ নোট
- সত্যিকারের ফোনে লগইনসহ Code/Search/Image মোড যাচাই হয়নি।
- `engine-arena-cdp.test.mjs` স্যান্ডবক্স পরিবেশে ঝুলে যায় (লোকাল নেটওয়ার্ক সীমা); CI-তে চলে।
- `package.json`-এ অপ্রয়োজনীয় web-টেমপ্লেট dependency আছে; সরানো একটি আলাদা ঝুঁকিহীন-পরিষ্কার কাজ (lockfile পুনর্জেনারেট লাগবে)।

### পরবর্তী ধাপ
1. `main`-এ merge হয়েছে কিনা Releases পাতায় দেখো (Release job `v2.4.0` ট্যাগে `arenapilot-latest.apk` প্রকাশ করে)।
2. ফোনে APK ইনস্টল করে Text → Code → Search → Image পেজে একটি করে বাস্তব বার্তা পাঠিয়ে ফলাফল এখানে লেখো।
