# ArenaPilot V3 — Owner brief (condensed copy)

> **Note:** this is a condensed, structured copy of the owner's long Bengali brief for this run
> (Phase 0 → Phase 1 → Phase 2A). It keeps every rule, scope boundary and acceptance criterion;
> it is not a word-for-word transcript. Credentials that were pasted into the original brief are
> deliberately **not** stored here.

Owner language: Bengali. Answers, PR descriptions and reports in Bengali; code/commands/technical terms in English.

## Three principles
1. Evidence, not assumption: read files, grep, run tests. Never say "works" for what was not verified.
2. Stay in scope (§Forbidden).
3. Small verifiable steps; run tests after every change.

## Run scope
Phase 0 (baseline) → Phase 1 (audit + remove local sandbox + stop-gap prompt fix) → Phase 2A (mode-aware Prompt Director).
One branch and one PR per phase. Do not start Phase 2B or later. If not everything can be finished, ship what is safe and say where you stopped.

## Product facts (verified by owner)
- ArenaPilot = unofficial Android app wrapping arena.ai Direct Chat in a WebView, injecting a JS engine. No API key, no login/captcha bypass; messages go only through the page's own composer.
- `content.js`, `injected.js`, `sandbox.js` are minified patched supersets of EdgeTypE/better-deepseek v0.1.14 (see `scripts/bds-sync.sh`). Readable source of content.js is not in this repo.
  - Change content.js only via tiny anchor-token seams + an anchor-verifying test; put new logic in new readable modules (like `sd-site.js`).
  - Never run `scripts/bds-sync.sh --replace`.
- Today's prompt: one huge `ARENA_PROMPT` in `sd-site.js`, taken by content.js via seam `du=sdsIsArena()?window.__sdSite.arenaPrompt:sdsLegacyPrompt`, sent with the first message of each conversation (first turn = `api.firstTurnPath` `/nextjs-api/stream/create-evaluation`). Text/Code/Search all get the same block + a small addendum. Image: `inject:false`.
- Arena file input accepts only images (png/jpeg/webp); text-like files go inline in the composer.
- Native-preservation: never change style/class/attributes of Arena's React/Next-owned DOM; only engine-owned `#bds-root` / `.bds-*`.
- Engine UI shape (attach menu, drawer/settings pages, `.bds-*` styling) must not change, except the small read-only Prompt Inspector.

## Target (owner)
A. Remove the app's own Linux PRoot/Alpine sandbox, Linux Studio, `sandbox://linux` MCP server, sandbox-dependent agent instructions and needless native dependencies. Arena's official Code Mode sandbox stays; **no second sandbox**. Keep existing persistence for Memory / Projects / Settings. No new workspace storage, sync or SAF mirror now.
B. Improve shared features (MCP, Memory, Projects, Personas, Skills, bottom drawer + Advanced Settings, file upload/attachments/history/downloads) — this is Phase 2B, **not this run**.
C. Four separate environments — Text (general assistant), Code (Arena official sandbox), Search (research), Image (zero contamination) — each with its own playbook, context policy, skill policy, tool availability, error handling. One instruction must not be used blindly for all four.

## Roadmap
0 baseline ← this run · 1 audit & cleanup ← this run · 2A prompt director ← this run · 2B shared core · 3 Text · 4 Search · 5 Image (zero injection) · 6 Code (capture Arena's official sandbox first with `tools/arena-capture`) · 7 integrated QA (upgrade test, DOM drift canary) · 8 V3 release.

## Engineering rules
1. content.js: tiny seam + anchor test; new logic in readable modules; document where content.js source lives (upstream).
2. Data: versioned schemas, safe migrations, old data intact on failure.
3. Security: tool output / fetched content untrusted; no secrets in prompts or logs; confirm destructive actions.
4. Observability: use sd-health.js notices and debug logs; no silent failures.
5. Performance: measure startup and injected-prompt size before/after.
6. Dead code (apiPlayground, statusMonitor, pricing, whatsNewPopup, voice, sdsLegacyPrompt…): list in audit; delete only if completely safe, otherwise disable via seam.
7. Licence attribution in `docs/licenses/` kept; update for removed components.
8. Docs: README, docs/PLAN.md, docs/v3/* updated each phase.
9. When in doubt (esp. before deleting) → PR "Open Questions".

## Forbidden in this run
- New workspace file storage, sandbox file sync, SAF mirror, GitHub repo automation, persistent workspace.
- Any second sandbox / own execution environment in Code Mode.
- Changing Arena Battle / Side-by-side / Agent modes.
- Styling/class/attribute changes on Arena-owned DOM; asking for API keys; login/captcha bypass; bypassing the page composer.
- `bds-sync.sh --replace`; blind hand-editing of content.js.
- Deleting or corrupting user data (Memory, Projects, Settings, `EngineStore.kt`, `NativeBlobStore.kt`).

## Phase 0 checklist
Tag `pre-v3-sandbox`; run `npm ci && npm test` and `cd android && ./gradlew testDebugUnitTest assembleDebug`; record pass/fail and pre-existing failures separately; record APK and asset sizes; measure baseline injected prompt per mode (vm-based, `docs/v3/baseline-prompts/`); write `phase-0-baseline.md`; PR "Phase 0: baseline & safety net".

## Phase 1 checklist
Audit report first (`docs/v3/phase-1-audit.md`): feature status with evidence, sandbox dependency map, prompt injection code locations, shared-feature assessment, risks/open questions.
Then remove sandbox: Kotlin (Sandbox, SandboxService, SandboxTools, ShellProtocol, Studio*, TarGz/Downloads parts, hooks in MainActivity/WebViewBridge), JS hooks (sd-agent/sd-native/content/injected), `sandbox.js`/`sandbox.html` **only if they are the PRoot bridge** (if it is the browser CODE_RUNNER runtime: keep, document, ask the owner), build/CI (build_proot.py, fetch_sandbox_deps.py, proot patch, sandbox_apk_check, emulator-smoke, gradle, workflow, release-hygiene test), manifest (service, permissions, activity), docs/licence, tests updated deliberately.
Cautions: check other features' dependencies first; safe cleanup of old sandbox data (never Memory/Projects/Settings); stop-gap prompt fix (remove LINUX AND MCP sandbox examples, PLAN.md/PROGRESS.md sentence, sandbox lines of CODE/SEARCH addenda; keep generic MCP text; Code addendum: "only what Arena's official environment provides"); show APK/native-dependency before/after.
Verify: grep proof, `npm ci && npm test`, Gradle test/assemble, emulator smoke if possible; state what could not be verified. PR "Phase 1: remove local sandbox, audit, stop-gap prompt fix".

## Phase 2A checklist
Investigate first (`docs/v3/phase-2a-notes.md`): where the first-turn prompt is joined and lands in `userMessage.content`; where settings live; how MCP/project/persona/skills/memory reach the join; which flags enable each capability; when modality is reliably known (request body at first send).
Build `bds/sd-prompt.js` (ES2017, idempotent, no deps; loads right after sd-site.js, before injected.js/content.js; update `injectBdsScripts` in MainActivity and `ENGINE_SEQUENCE` in tools/harness). API: `window.__sdPrompt.compose(ctx) → { text, manifest }`.
Modules: CORE · TAG_SAFETY · CAPABILITY (MCP tags, VISUALIZER, CHART, FILES, DOCS, FETCH, RESEARCH, CODE_RUNNER — each only when active; port APH tag syntax verbatim, drop sandbox parts) · MODE (TEXT, CODE, SEARCH; image/video/audio = nothing) · USER-CONTEXT (PROJECT, PERSONA, SKILLS, MEMORY).
Priority order: safety & honesty > user's current request > this mode's rules > project > persona > skills > memory.
Matrix (start point): Image = nothing at all; Code = no VISUALIZER/CHART, no CODE_RUNNER, MCP opt-in; Search = no FETCH, CHART optional, RESEARCH only if explicit; Persona in Code/Search only language/tone; Memory opt-in minimal.
When: first turn only, by first-send body modality; fail-closed (compose failure / unknown modality → minimal CORE + TEXT; never the old huge block); instructions switch off → nothing; Image prompt reaches Arena byte-identical.
Token budget enforced by tests: CORE ≈250, each MODE ≈220, each CAPABILITY ≈200; user-context items capped and trimmed with manifest notice. Goal: ordinary Text chat ≈ half of today or less; Code/Search smaller still.
Prompt Inspector: small read-only preview in Advanced Settings (manifest per mode) — no other UI changes.
Tests: golden snapshots, image/video/audio = zero, no sandbox words, no inactive capability names/tags, budget, priority sentence, toggle, fail-closed, unknown modality, trimming. Update existing tests deliberately, never weaken. `docs/v3/prompt-evals.md` = owner's manual eval pack (~10 scenarios per mode).
PR "Phase 2A: mode-aware prompt director".

## Final report (Bengali)
(1) removed/changed/added per phase with file list; (2) test results with commands; (3) what could not be verified; (4) before/after APK size, injected prompt size per mode, startup measurements; (5) open questions (sandbox.js / CODE_RUNNER, browser runner in Text Mode, Arena Code Mode capture, mid-conversation modality change); (6) Phase 2B recommendations.
