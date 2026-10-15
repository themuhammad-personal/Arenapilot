// ArenaPilot in CI — the emulator smoke script and the workflow that runs it.
//
// Nothing here LAUNCHES ArenaPilot for real: this file drives the smoke script
// (android/ci/emulator-smoke.sh) against a FAKE `adb`, so every branch —
// notice shown / not shown / returns / stuck / crash / wrong site / unreadable
// UI — has a case that runs in seconds, without an emulator. The workflow
// wiring is pinned as text: the matrix, the build task, the artifact names.
//
// Since the 2026-10-15 cleanup this repo builds ONE app: ArenaPilot
// (com.arenadeck.app). There is no flavor dimension anymore — the old
// Super DeepSeek flavor jobs and their branches are gone by design.
//
// Run: npm run test:engine
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../../../../..");
const SMOKE = path.join(REPO, "android/ci/emulator-smoke.sh");
const WORKFLOW = fs.readFileSync(
  path.join(REPO, ".github/workflows/build-and-release-apk.yml"),
  "utf8",
);
const SMOKE_SRC = fs.readFileSync(SMOKE, "utf8");

// ── a fake adb, and a world to run the real script in ───────────────────────

const NOTICE_XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" class="android.widget.FrameLayout" package="PKG" bounds="[0,0][1080,2400]">
    <node index="0" text="An independent app · স্বতন্ত্র অ্যাপ" resource-id="android:id/alertTitle" class="android.widget.TextView" package="PKG" bounds="[100,900][980,1000]" />
    <node index="1" text="OK" resource-id="android:id/button1" class="android.widget.Button" package="PKG" bounds="[800,1500][1000,1620]" />
  </node>
</hierarchy>`;
const PAGE_XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" class="android.widget.FrameLayout" package="PKG" bounds="[0,0][1080,2400]">
    <node index="0" text="Ask anything" class="android.widget.EditText" package="PKG" bounds="[40,2000][1040,2200]" />
  </node>
</hierarchy>`;

const FAKE_ADB = `#!/usr/bin/env bash
S="$FAKE_STATE"
cmd="$1"; shift
case "$cmd" in
  wait-for-device) exit 0 ;;
  forward) echo "forward $*" >> "$S/forward"; [ -f "$S/forward-fails" ] && exit 1; exit 0 ;;
  install) echo "Success"; exit 0 ;;
  logcat)
    if [ "$1" = "-d" ]; then cat "$S/logcat"; fi
    exit 0 ;;
  pull)
    dst="$2"
    case "$1" in
      /sdcard/ui.xml) cp "$S/device-ui.xml" "$dst" ;;
      *) : > "$dst" ;;
    esac
    exit 0 ;;
  shell)
    sub="$1"; shift
    case "$sub" in
      am)
        if [ "$1" = "start" ]; then
          n=$(( $(cat "$S/launches" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$S/launches"
          echo "$*" >> "$S/am-start"
          rm -f "$S/dismissed"
          if [ -f "$S/start-fails" ]; then echo "Error: launch failed"; exit 1; fi
          if [ "$n" = "2" ] && [ -f "$S/second-dead" ]; then touch "$S/dead"; fi
          echo "Status: ok"
        fi
        exit 0 ;;
      pidof) if [ -f "$S/dead" ]; then exit 1; fi; echo 4242; exit 0 ;;
      input)
        if [ "$1" = "tap" ]; then
          echo "$2 $3" >> "$S/taps"
          [ -f "$S/tap-does-nothing" ] || touch "$S/dismissed"
        fi
        exit 0 ;;
      uiautomator)
        if [ -f "$S/ui-broken" ]; then exit 1; fi
        launch=$(cat "$S/launches" 2>/dev/null || echo 1)
        show=no
        if [ "$launch" = "1" ] && [ -f "$S/notice-first" ]; then show=yes; fi
        if [ "$launch" != "1" ] && [ -f "$S/notice-again" ]; then show=yes; fi
        if [ -f "$S/dismissed" ]; then show=no; fi
        if [ "$show" = "yes" ]; then
          cp "$S/notice.xml" "$S/device-ui.xml"
        else
          cp "$S/page.xml" "$S/device-ui.xml"
        fi
        exit 0 ;;
      *) exit 0 ;;
    esac ;;
  *) exit 0 ;;
esac
`;

/**
 * Runs the real emulator-smoke.sh against the fake adb.
 * `world` switches (all default off): noticeFirst, noticeAgain, tapDoesNothing,
 * dead, uiBroken, crash, apkCheckExit, site ('arena' | 'deepseek' | 'none'),
 * engineReady, cap, injected, logLines (extra logcat lines), forwardFails (no
 * devtools socket), probeExit.
 */
function runSmoke(world = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-"));
  const state = path.join(dir, "state");
  const bin = path.join(dir, "bin");
  const out = path.join(dir, "out");
  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "adb"), FAKE_ADB, { mode: 0o755 });

  const pkg = "com.arenadeck.app";
  fs.mkdirSync(path.join(dir, "android/app/build/outputs/apk/debug"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(dir, "android/app/build/outputs/apk/debug", "app.apk"),
    "",
  );
  // the static APK check has its own tests; here it is a stand-in with a chosen exit code
  fs.mkdirSync(path.join(dir, "android/ci"), { recursive: true });
  fs.copyFileSync(
    path.join(REPO, "android/ci/crash_check.py"),
    path.join(dir, "android/ci/crash_check.py"),
  );
  // the CDP probe has its own tests (engine-arena-cdp.test.mjs); here it is a stand-in that records how it was called
  fs.writeFileSync(
    path.join(dir, "android/ci/cdp_probe.mjs"),
    `import fs from 'node:fs';\nfs.appendFileSync(process.env.FAKE_STATE + '/probe-args', process.argv.slice(2).join(' ') + '\\n');\nconsole.log('::notice::stand-in cdp probe ran');\nprocess.exit(${world.probeExit || 0});\n`,
  );
  fs.writeFileSync(
    path.join(dir, "android/ci/apk_check.py"),
    `import sys\nprint('stand-in apk_check', sys.argv[1:])\nsys.exit(${world.apkCheckExit || 0})\n`,
  );

  fs.writeFileSync(
    path.join(state, "notice.xml"),
    NOTICE_XML.replaceAll("PKG", pkg),
  );
  fs.writeFileSync(
    path.join(state, "page.xml"),
    PAGE_XML.replaceAll("PKG", pkg),
  );
  for (const [flag, file] of [
    ["noticeFirst", "notice-first"],
    ["noticeAgain", "notice-again"],
    ["tapDoesNothing", "tap-does-nothing"],
    ["startFails", "start-fails"],
    ["secondDead", "second-dead"],
    ["dead", "dead"],
    ["uiBroken", "ui-broken"],
    ["forwardFails", "forward-fails"],
  ]) {
    if (world[flag]) fs.writeFileSync(path.join(state, file), "");
  }
  const site = world.site || "arena";
  const lines = [];
  if (site === "arena")
    lines.push(
      "D SuperDeepSeek: Official WebView loaded: https://arena.ai/text/direct",
    );
  if (site === "deepseek")
    lines.push(
      "D SuperDeepSeek: Official WebView loaded: https://chat.deepseek.com/",
    );
  if (world.crash)
    lines.push(
      `E AndroidRuntime: FATAL EXCEPTION: main\nE AndroidRuntime: Process: ${pkg}`,
    );
  if (world.engineReady)
    lines.push("D SuperDeepSeek: Engine UI ready — releasing launch screen");
  if (world.cap)
    lines.push(
      "W SuperDeepSeek: Launch screen cap reached — revealing the page",
    );
  if (world.injected) lines.push("D BDS: injected.js done");
  for (const l of world.logLines || []) lines.push(l);
  fs.writeFileSync(path.join(state, "logcat"), lines.join("\n") + "\n");

  const res = spawnSync("bash", [SMOKE], {
    cwd: dir,
    encoding: "utf8",
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: process.env.HOME,
      PYTHONPATH: process.env.PYTHONPATH || "",
      FAKE_STATE: state,
      SMOKE_OUT: out,
      SMOKE_STRICT: world.strict ? "1" : "0",
      SMOKE_BOOT_WAIT: "0",
      SMOKE_NOTICE_WAIT: "0",
      SMOKE_UI_RETRY_SLEEP: "0",
    },
    timeout: 60000,
  });
  const read = (f) =>
    fs.existsSync(path.join(state, f))
      ? fs.readFileSync(path.join(state, f), "utf8")
      : "";
  const result = {
    code: res.status,
    out: `${res.stdout}\n${res.stderr}`,
    taps: read("taps").trim().split("\n").filter(Boolean),
    launches: Number(read("launches") || 0),
    amStart: read("am-start").trim().split("\n").filter(Boolean),
    forward: read("forward").trim().split("\n").filter(Boolean),
    probeArgs: read("probe-args").trim().split("\n").filter(Boolean),
    artifacts: fs.existsSync(out) ? fs.readdirSync(out) : [],
  };
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

// ── 1. the independence notice ──────────────────────────────────────────────

test("ArenaPilot: notice on the first launch, accepted with OK, absent on the second", () => {
  const r = runSmoke({ noticeFirst: true });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /notice shown on first launch/);
  assert.match(r.out, /notice accepted/);
  assert.match(r.out, /no notice on the second launch/);
  assert.deepEqual(
    r.taps,
    ["900 1560"],
    "it taps the centre of the OK button, [800,1500][1000,1620]",
  );
  assert.equal(r.launches, 2, "two launches: first and the persistence check");
  assert.match(
    r.out,
    /::notice::ArenaPilot: first-launch notice shown, accepted with OK/,
  );
  assert.match(r.out, /::notice::ArenaPilot: no notice on the second launch/);
  assert.match(r.out, /::notice::ArenaPilot opened arena\.ai/);
  for (const f of [
    "apk-check.txt",
    "ui-first.xml",
    "ui-second.xml",
    "logcat.txt",
    "screen.png",
    "screen-accepted.png",
  ]) {
    assert.ok(r.artifacts.includes(f), `artifact ${f}`);
  }
});

test("ArenaPilot is launched by its FULL class name — `.MainActivity` would resolve against com.arenadeck.app", () => {
  const r = runSmoke({ noticeFirst: true });
  assert.ok(r.amStart.length >= 1);
  for (const line of r.amStart) {
    assert.match(
      line,
      /-n com\.arenadeck\.app\/com\.superdeepseek\.app\.MainActivity/,
    );
    assert.ok(!/\/\.MainActivity/.test(line));
  }
});

test("ArenaPilot: no notice on the first launch is an error", () => {
  const r = runSmoke({});
  assert.equal(r.code, 1);
  assert.match(
    r.out,
    /::error::ArenaPilot did not show its independence notice on the first launch/,
  );
});

test('ArenaPilot: a notice that comes back on the second launch means "seen" was not persisted', () => {
  const r = runSmoke({ noticeFirst: true, noticeAgain: true });
  assert.equal(r.code, 1);
  assert.match(r.out, /::error::the notice came back on the second launch/);
});

test("ArenaPilot: a notice that survives the OK tap is an error", () => {
  const r = runSmoke({ noticeFirst: true, tapDoesNothing: true });
  assert.equal(r.code, 1);
  assert.match(
    r.out,
    /::error::the notice is still on screen after tapping OK/,
  );
});

test("ArenaPilot: if the UI cannot be read the notice is unverified, not failed", () => {
  const r = runSmoke({ uiBroken: true });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /::warning::could not read the UI/);
  assert.ok(!/::error::/.test(r.out));
});

test("ArenaPilot must never open DeepSeek", () => {
  const r = runSmoke({ noticeFirst: true, site: "deepseek" });
  assert.equal(r.code, 1);
  assert.match(r.out, /::error::ArenaPilot navigated to chat\.deepseek\.com/);
});

test("ArenaPilot: an offline emulator (no page load in the log) is only a warning", () => {
  const r = runSmoke({ noticeFirst: true, site: "none" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /::warning::no arena\.ai page load in logcat/);
});

// ── 2. process health ───────────────────────────────────────────────────────

test("a crash fails the run", () => {
  const r = runSmoke({ noticeFirst: true, crash: true });
  assert.equal(r.code, 1);
  assert.match(r.out, /::error::crash or ANR detected/);
});

test("a crash puts its excerpt in the annotation, with long opaque strings masked (the job log is not readable from outside)", () => {
  const r = runSmoke({
    crash: true,
    logLines: [
      `E AndroidRuntime: java.lang.IllegalStateException: token ${"Q".repeat(50)}`,
    ],
  });
  assert.equal(r.code, 1);
  const line = r.out
    .split("\n")
    .find((l) => l.startsWith("::error::crash or ANR detected"));
  assert.ok(line, "the error annotation is there");
  assert.ok(line.includes("FATAL EXCEPTION: main"), "with the exception line");
  assert.ok(
    line.includes("Process: com.arenadeck.app"),
    "and the lines after it",
  );
  assert.ok(
    line.includes("%0A"),
    "newline-encoded so it survives as one annotation",
  );
  assert.ok(
    !r.out.includes("Q".repeat(50)),
    "no long opaque string reaches the log",
  );
});

test("a dead process fails the run", () => {
  const r = runSmoke({ noticeFirst: true, dead: true });
  assert.equal(r.code, 1);
  assert.match(r.out, /::error::app process is not alive/);
});

test("a failing static APK check fails the run, whatever the runtime did", () => {
  const r = runSmoke({ noticeFirst: true, apkCheckExit: 1 });
  assert.equal(r.code, 1);
  const ok = runSmoke({ noticeFirst: true, apkCheckExit: 0 });
  assert.equal(ok.code, 0);
  assert.match(
    ok.out,
    /::notice::ArenaPilot APK: package, label, launcher and icons verified inside the APK/,
  );
});

test("the script parses", () => {
  const r = spawnSync("bash", ["-n", SMOKE], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("there is no flavor dimension left to misconfigure", () => {
  assert.ok(
    !/FLAVOR/.test(SMOKE_SRC),
    "the script no longer knows about flavors",
  );
  assert.ok(
    !/deepseek\/debug|arenaDeck\/debug/.test(SMOKE_SRC),
    "no flavor output directories either",
  );
});

// ── 3. the workflow wiring ──────────────────────────────────────────────────

/** The `emulator:` job, as text. */
function emulatorJob() {
  const start = WORKFLOW.indexOf("\n  emulator:");
  assert.ok(start > 0, "the emulator job is gone");
  const rest = WORKFLOW.slice(start + 1);
  const next = rest.slice(12).search(/\n {2}[a-z][a-z-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 12);
}

test("the emulator matrix is ArenaPilot on API 34 — one app, one job", () => {
  const job = emulatorJob();
  assert.ok(
    job.includes("api-level: 34, flavor: ArenaDeck"),
    "the single matrix entry",
  );
  assert.ok(!job.includes("flavor: Deepseek"), "no Super DeepSeek jobs remain");
  assert.ok(job.includes("fail-fast: false"));
  assert.ok(
    job.includes("continue-on-error: false"),
    "the ArenaPilot launch is a required gate",
  );
});

test("the job builds the single debug APK and hands no flavor to the script", () => {
  const job = emulatorJob();
  assert.ok(job.includes("./gradlew --no-daemon assembleDebug"));
  assert.ok(job.includes("bash android/ci/emulator-smoke.sh"));
  assert.ok(
    !job.includes("FLAVOR="),
    "the flavor variable is gone from the wiring",
  );
});

test("the smoke artifacts are named for the one app", () => {
  const job = emulatorJob();
  assert.ok(
    job.includes("name: emulator-smoke-api-${{ matrix.api-level }}-arena"),
  );
});

test("the unit tests and lint run the single-variant tasks", () => {
  assert.ok(WORKFLOW.includes("./gradlew --no-daemon testDebugUnitTest"));
  assert.ok(WORKFLOW.includes("./gradlew --no-daemon assembleRelease"));
  assert.ok(WORKFLOW.includes("./gradlew --no-daemon lintDebug"));
  assert.ok(
    !/assembleDeepseek|assembleArenaDeck|testDeepseek|testArenaDeck|lintDeepseek|lintArenaDeck/.test(
      WORKFLOW,
    ),
    "no flavored Gradle tasks anywhere in the workflow",
  );
});

test("the repository releases exactly one APK channel: arena-latest / ArenaPilot", () => {
  assert.ok(WORKFLOW.includes("tag_name: arena-latest"));
  assert.ok(WORKFLOW.includes("name: arenapilot-apk"));
  assert.ok(
    !WORKFLOW.includes("name: super-deepseek-apk"),
    "the old Super DeepSeek artifact is gone",
  );
  assert.ok(
    !/Publish Release[\s\S]*Super DeepSeek v/.test(WORKFLOW),
    "no Super DeepSeek release job remains",
  );
});

// ── 4. the static APK check ─────────────────────────────────────────────────

test("apk_check.py: accepts the right APK and rejects every wrong one (needs Pillow)", (t) => {
  const hasPillow =
    spawnSync("python3", ["-c", "import PIL"], { encoding: "utf8" }).status ===
    0;
  if (!hasPillow) {
    t.skip(
      "Pillow is not installed — the CI emulator job runs this check on the real APK",
    );
    return;
  }
  const r = spawnSync(
    "python3",
    ["-m", "unittest", "android/ci/test_apk_check.py"],
    { cwd: REPO, encoding: "utf8", timeout: 120000 },
  );
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
});

test("the smoke script runs the static check before it installs anything", () => {
  const check = SMOKE_SRC.indexOf("android/ci/apk_check.py");
  const install = SMOKE_SRC.indexOf("adb install");
  assert.ok(
    check > 0 && install > check,
    "a wrong APK must be reported even if it would crash on install",
  );
});

// ── 5. did the engine come up on the page? (informational) ──────────────────

test("runtime facts: engine UI ready and injected, no cap → plain notices, no warning", () => {
  const r = runSmoke({ noticeFirst: true, engineReady: true, injected: true });
  assert.equal(r.code, 0, r.out);
  assert.match(
    r.out,
    /::notice::ArenaPilot runtime: engine UI ready=yes, launch-screen cap reached=no, injected\.js done=yes/,
  );
  assert.ok(!/only lifted at its 18 s cap/.test(r.out));
});

test("runtime facts: a launch screen that only lifted at its cap is called out", () => {
  const r = runSmoke({ noticeFirst: true, cap: true, injected: true });
  assert.equal(r.code, 0, "informational: it never fails the run");
  assert.match(
    r.out,
    /::notice::ArenaPilot runtime: engine UI ready=no, launch-screen cap reached=yes, injected\.js done=yes/,
  );
  assert.match(
    r.out,
    /::warning::ArenaPilot: the launch screen only lifted at its 18 s cap/,
  );
});

test("runtime facts: page console errors are reported, long opaque strings masked, several joined for annotations", () => {
  const secret = "A".repeat(48);
  const r = runSmoke({
    noticeFirst: true,
    logLines: [
      `I chromium: [INFO:CONSOLE(12)] "Uncaught TypeError: x is not a function ${secret}", source: https://arena.ai/_next/x.js (12)`,
      'I chromium: [INFO:CONSOLE(7)] "[SDS] Guard check: something", source: (7)',
      'I chromium: [INFO:CONSOLE(3)] "an ordinary page log", source: https://arena.ai/y.js (3)',
    ],
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /::warning::ArenaPilot page console: /);
  assert.ok(
    r.out.includes("Uncaught TypeError: x is not a function <opaque>"),
    "the opaque string is masked",
  );
  assert.ok(!r.out.includes(secret), "the raw string never reaches the log");
  assert.ok(
    r.out.includes("[SDS] Guard check"),
    "the engine warning is included",
  );
  assert.ok(
    !r.out.includes("an ordinary page log"),
    "ordinary page logs are not",
  );
  assert.match(
    r.out,
    /%0A/,
    "two messages are joined with the annotation newline",
  );
});

test("runtime facts: a clean console says so", () => {
  const r = runSmoke({ noticeFirst: true, engineReady: true });
  assert.equal(r.code, 0, r.out);
  assert.match(
    r.out,
    /::notice::ArenaPilot page console: no uncaught errors or engine warnings in logcat/,
  );
});

// ── 6. the CDP probe inside the smoke ───────────────────────────────────────

test("the probe is called through the WebView devtools socket of the running process", () => {
  const r = runSmoke({ noticeFirst: true });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(
    r.forward,
    [
      "forward tcp:9222 localabstract:webview_devtools_remote_4242",
      "forward --remove tcp:9222",
    ],
    "forwarded to the pid adb reported, then cleaned up",
  );
  assert.equal(r.probeArgs.length, 1);
  assert.match(
    r.probeArgs[0],
    /^--port 9222 --out \S+ --capture tools\/arena-capture\/capture\.js --required 0$/,
  );
  assert.match(r.out, /::notice::stand-in cdp probe ran/);
});

test("a probe that dies, or a missing devtools socket, only warns", () => {
  const dies = runSmoke({ noticeFirst: true, probeExit: 3 });
  assert.equal(dies.code, 0, dies.out);
  assert.match(dies.out, /::warning::the CDP probe did not finish/);
  assert.deepEqual(
    dies.forward.slice(-1),
    ["forward --remove tcp:9222"],
    "and the port is still released",
  );

  const noSocket = runSmoke({ noticeFirst: true, forwardFails: true });
  assert.equal(noSocket.code, 0, noSocket.out);
  assert.match(
    noSocket.out,
    /::warning::no WebView devtools socket for pid '4242' — the CDP probe was skipped/,
  );
  assert.equal(noSocket.probeArgs.length, 0, "nothing to probe");
});

test("the probe runs after the notice flow, so the page it looks at is the one the user sees", () => {
  const notice = SMOKE_SRC.indexOf(
    "second launch (the notice must not return)",
  );
  const probeAt = SMOKE_SRC.indexOf("cdp_probe.mjs");
  assert.ok(notice > 0 && probeAt > notice);
});

test("the capture goes out in its own workflow step, because GitHub allows ten annotations per step", () => {
  const job = emulatorJob();
  const smokeAt = job.indexOf("name: Boot emulator and smoke-test the app");
  const reportAt = job.indexOf("name: Report the CDP capture (ArenaPilot)");
  const uploadAt = job.indexOf("name: Upload smoke screenshots and logcat");
  assert.ok(
    smokeAt > 0 && reportAt > smokeAt && uploadAt > reportAt,
    "smoke, then report, then upload",
  );
  const step = job.slice(reportAt, uploadAt);
  assert.ok(step.includes("if: always()"), "reported even if the smoke failed");
  assert.ok(
    step.includes(
      "node android/ci/cdp_probe.mjs --report /tmp/emulator-smoke/cdp-capture.json",
    ),
  );
});

test("evidence steps survive a failed smoke (always()), and uploads do too", () => {
  const job = emulatorJob();
  const sandboxReport = job.slice(
    job.indexOf("name: Report native sandbox evidence"),
  );
  assert.ok(
    sandboxReport.slice(0, 200).includes("if: always()"),
    "sandbox evidence is reported even after a failure",
  );
  const upload = job.slice(
    job.indexOf("name: Upload smoke screenshots and logcat"),
  );
  assert.ok(
    upload.slice(0, 200).includes("if: always()"),
    "artifacts upload even after a failure",
  );
});

// Regression: a launcher screen after process death is NOT persisted acceptance.
test("ArenaPilot: mandatory smoke rejects unreadable UI instead of passing unverified notice", () => {
  const r = runSmoke({ strict: true, uiBroken: true });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /notice is unverified/);
});

test("ArenaPilot: process loss on second launch cannot claim notice persistence", () => {
  const r = runSmoke({ noticeFirst: true, secondDead: true });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /second-boot: app process is not alive/);
  assert.doesNotMatch(r.out, /no notice on the second launch/);
  for (const f of [
    "launch-1.log",
    "launch-2.log",
    "first-end-logcat.txt",
    "second-boot-logcat.txt",
    "second-boot-exit-info.txt",
  ]) {
    assert.ok(r.artifacts.includes(f), f);
  }
});

test("am start failure is not hidden by a surviving process", () => {
  const r = runSmoke({ noticeFirst: true, startFails: true });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /am start failed/);
});

test("mandatory Arena runtime smoke fails when the CDP gate fails or cannot run", () => {
  for (const world of [{ probeExit: 1 }, { forwardFails: true }]) {
    const r = runSmoke({ noticeFirst: true, strict: true, ...world });
    assert.equal(r.code, 1, r.out);
  }
});

test("uiautomator fatal is not attributed to a healthy APK (observed Android CI regression)", () => {
  const r = runSmoke({
    noticeFirst: true,
    logLines: [
      "10-14 03:03:51.657  4887  4902 E AndroidRuntime: FATAL EXCEPTION: UiAutomation",
      "10-14 03:03:51.657  4887  4902 E AndroidRuntime: PID: 4887",
      "10-14 03:03:51.657  4887  4902 E AndroidRuntime: java.lang.RuntimeException: Bad file descriptor",
    ],
  });
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /crash or ANR detected/);
});
