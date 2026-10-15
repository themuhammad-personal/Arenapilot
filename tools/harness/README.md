# ArenaPilot engine harness (Layer 2)

Runs the **real engine bundle** (the same files MainActivity injects, in the
same order) inside a real headless Chromium against a fixture page that
behaves like `chat.deepseek.com`, with a fake `AndroidBridge` and a scriptable
Linux sandbox. This is the layer between the vm unit tests and the Android
emulator: same engine code, real DOM, real timers, real fetch interception.

```bash
npm run test:harness                 # all scenarios
node tools/harness/run.mjs keep-going agent-once
```

Exit code 0 when nothing fails — `SKIP`ped scenarios are reported but do not
fail the run (CI report-job mode). Results land in
`tools/harness/artifacts/report.json` with screenshots (never committed).

## What is real and what is modelled

| Real (unchanged engine code) | Modelled (fixture) |
| --- | --- |
| `sd-site.js`, `injected.js`, `content.css`, `our-skin.css`, `content.js`, `sd-native.js`, `sd-agent.js`, `sd-sheets.js`, `sd-health.js` | The `chat.deepseek.com` page: composer (`textarea#chat-input`), `div.ds-message` rows with the hashed classes (`._63c77b1`, `._4f9bf79._43c05b5`, `d29f3d7d`), streaming replies, send/stop toggle, `history_messages`/`fetch_page`, SPA navigation |
| Prompt injection (`<SuperDeepSeek>` wrapper), token accounting (`bds:token-usage`), MCP tool loop, run-once gate, keep-going nudges, Continue task chip, scroll guard, quiet sends, slash command composer | The DeepSeek **API** (`/api/v0/chat/completion` etc.) — scripted SSE beats per scenario; the **AndroidBridge** — an in-page double that records every call and serves `sandbox` tool outputs |

> **⚠️ Fixture provenance:** the page is a *model* of the captured
> `chat.deepseek.com` DOM, not a capture. Before this layer is trusted for
> release, the owner must either (a) capture the real page (View Source / save
> complete Web page, personal data stripped) and replace
> `tools/harness/fixture/chat.html`, or (b) confirm the class names and
> endpoints above still match production. Everything this layer proves is only
> as good as that fixture.

## Scenarios

| Scenario | Asserts (the must-have list) |
| --- | --- |
| `agent-once` | A chained task (run → write_file → final) completes; **each tool call executes exactly once**; automatic messages go out **quietly** (composer hidden, never typed); the prompt carries the `<SuperDeepSeek>` wrapper |
| `no-rerun` | After **reload / scroll / reprocess** no finished tool call runs again (bridge log grows by zero) |
| `scroll-guard` | A reader who scrolls up during streaming is **not pulled back to the bottom** |
| `keep-going` | Automatic continuation stops after **2 nudges**, then the **Continue task** chip appears; tapping it lets the agent finish (the tap does not spend the budget) |
| `slash-commands` | Typing `/` mounts the command popup and the command sheet; Enter runs a slash command through `sdRunCommand`; `window.__sdHandleBack` exists for native Back |
| `settings-pages` | Settings overview lists the Linux & Agent row; the Linux card only appears on its own page *(needs a real-page capture — SKIPped)* |
| `themes` | Light/dark switches keep the engine healthy (`reportTheme`, both screenshots) |
| `bidi-text` | A mostly-Arabic Arabic-leading paragraph renders RTL; a mixed Bengali/Arabic/English paragraph does not |
| `sheets-drag` | Touch-dragging a sheet down 220 px closes it *(needs a real-page capture — SKIPped)* |

## Layout

- `harness.mjs` — browser launch (@sparticuz/chromium), request interception,
  fake `AndroidBridge` (records + `localStorage` mirror that survives reload),
  engine injection in MainActivity's exact order, scripted beats, snapshots.
- `run.mjs` — the scenarios and the CLI runner.
- `fixture/chat.html` — the mini DeepSeek page (see provenance note above).
- `artifacts/` — report + screenshots. Ignored by git.

## Fail-before / pass-after evidence

`keep-going` is the reproducing test for the reply-end detection bug: on the
old `watchReplies` (500 ms poll edge only) a short agent reply — "Now I will
run the tests:" — could stream and finish between two polls, so `onReplyEnd`
never fired and keep-going nudges, the Continue chip and the reprocess timers
were dead. The run before the fix:

```
FAIL keep-going
  - keep-going must stop after 2 nudges (auto nudge responses: 0, sends: 0,1)
  - after the budget is spent the Continue task chip should appear
```

after the fix (thread-growth fallback + `bds:token-usage` completion signal +
once-per-reply scheduling, `sd-agent.js`, with `sd-agent.test.mjs` covering the
seam): `PASS keep-going`.


## ArenaPilot adapter integration (2026-10-14)

`npm run test:harness:arena` runs the **real bundle** on `fixture/arena.html`.
It never contacts arena.ai. Composer markup derives from the anonymous CI
capture; message/sidebar markup and stream timing are **modelled**. The native
sandbox is a recording test double, not Linux. It proves:

- default-off privacy reaches the final outgoing request;
- native attach style reset, button replacement and toolbar relocation leave
  one working engine `+` (including a real pointer click);
- Settings moves from composer fallback into a semantic sidebar, opens the
  drawer, and does not replace native Settings;
- completed assistant Visualizer markup produces an iframe containing the
  expected HTML, with raw source hidden;
- an MCP call reaches the fake bridge once, its result is sent through the
  composer, and the scripted follow-up appears; rescans do not rerun it;
- quoted user tool tags are not executed; Side-by-side is not processed.

The dedicated `Arena adapter integration` CI job is a failing gate, unlike
the older report-only DeepSeek harness job. Screenshots are ignored artifacts.
This does **not** prove live Arena protocol compatibility, real model compliance,
lossless arguments after Markdown rendering, authenticated UI, or native Linux
execution. Those are explicit next milestones in `docs/arena/ROADMAP-2-BN.md`.

On a minimal Linux host without NSS, the bundled Chromium includes its libraries:

```sh
node -e "require('./node_modules/@sparticuz/chromium/build/lambdafs.js').default.inflate('./node_modules/@sparticuz/chromium/bin/al2023.tar.br')"
LD_LIBRARY_PATH=/tmp/al2023/lib npm run test:harness:arena
```

CI uses its system Chrome instead (`PUPPETEER_EXECUTABLE_PATH`).
