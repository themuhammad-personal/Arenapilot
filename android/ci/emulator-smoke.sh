#!/usr/bin/env bash
# ArenaPilot (com.arenadeck.app) — Android emulator smoke (Layer 3 of the QA plan).
#
# Boots the real debug APK on the CI emulator, waits out the launch cap, then
# checks: the APK holds the right package/name/icons, the process is alive, the
# engine reached the page, there is no crash/ANR — and the first-launch
# independence notice: it shows on the first launch, accepts "OK", and on a
# second launch it does not show again (so "seen" really persisted).
#
# Screenshots, UI dumps and logcat go to /tmp/emulator-smoke, uploaded as CI
# artifacts (never committed). Key facts are also printed as ::notice:: lines so
# they survive in the job's annotations even when the artifacts are not opened.
#
# Test knobs (CI never sets them): SMOKE_BOOT_WAIT (s, default 25), SMOKE_NOTICE_WAIT
# (s, default 40), SMOKE_UI_RETRY_SLEEP (s, default 2), SMOKE_OUT. The script is
# exercised offline against a fake `adb` by android/app/src/test/js/engine-arena-ci.test.mjs.
set -uo pipefail
OUT=${SMOKE_OUT:-/tmp/emulator-smoke}
mkdir -p "$OUT"

PKG=com.arenadeck.app
# The Kotlin lives in the historical `com.superdeepseek.app` namespace:
# `.MainActivity` would resolve against the *package* and miss it.
ACTIVITY=com.superdeepseek.app.MainActivity
BOOT_WAIT="${SMOKE_BOOT_WAIT:-25}"
NOTICE_WAIT="${SMOKE_NOTICE_WAIT:-40}"
RETRY_SLEEP="${SMOKE_UI_RETRY_SLEEP:-2}"
NOTICE_TEXT="An independent app"   # the arena_notice_title in src/arenaDeck/res/values/strings.xml

APK=$(ls android/app/build/outputs/apk/debug/*.apk 2>/dev/null | head -1)
if [ -z "$APK" ]; then
  echo "::error::no debug APK found — build assembleDebug first"
  exit 1
fi

STATUS=0
STRICT=${SMOKE_STRICT:-0}
LAUNCH_NO=0

# ── 1. what is inside the APK (before anything runs) ─────────────────────────
echo "== static APK checks: $APK =="
PY=python3
if ! $PY -c 'import PIL' >/dev/null 2>&1; then
  if $PY -m venv "$OUT/venv" >/dev/null 2>&1 && "$OUT/venv/bin/pip" install --quiet pillow >/dev/null 2>&1; then
    PY="$OUT/venv/bin/python"
  else
    $PY -m pip install --quiet --break-system-packages pillow >/dev/null 2>&1 || $PY -m pip install --quiet pillow >/dev/null 2>&1 || true
  fi
fi
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/nonexistent}}"
AAPT=$(ls "$SDK"/build-tools/*/aapt 2>/dev/null | sort -V | tail -1)
# shellcheck disable=SC2086
$PY android/ci/apk_check.py --apk "$APK" --repo . ${AAPT:+--aapt "$AAPT"} > "$OUT/apk-check.txt" 2>&1
APK_CHECK=$?
cat "$OUT/apk-check.txt"
if [ "$APK_CHECK" -ne 0 ]; then STATUS=1; else echo "::notice::ArenaPilot APK: package, label, launcher and icons verified inside the APK"; fi

if [ "${SMOKE_NATIVE_SANDBOX:-0}" = "1" ]; then
  python3 android/ci/sandbox_apk_check.py "$APK" > "$OUT/sandbox-apk-check.txt" 2>&1 || STATUS=1
  cat "$OUT/sandbox-apk-check.txt"
  python3 android/ci/startup_check.py "$APK" --aapt "$AAPT" > "$OUT/startup-apk-check.txt" 2>&1 || STATUS=1
  cat "$OUT/startup-apk-check.txt"
fi

# ── 2. boot, install, launch ─────────────────────────────────────────────────
adb wait-for-device
adb shell input keyevent 82 >/dev/null 2>&1 || true
adb shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true

echo "== install $APK =="
adb install -r "$APK" > "$OUT/install.log" 2>&1 || {
  echo "::error::adb install failed"; cat "$OUT/install.log"; exit 1;
}

# The current UI hierarchy on stdout. `uiautomator dump` refuses to run while the
# window is not idle (a WebView that is still animating), so it is retried.
ui_dump() {
  local n
  for n in 1 2 3 4; do
    if adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 \
       && adb pull /sdcard/ui.xml "$OUT/ui.xml" >/dev/null 2>&1 && [ -s "$OUT/ui.xml" ]; then
      cat "$OUT/ui.xml"
      return 0
    fi
    sleep "$RETRY_SLEEP"
  done
  return 1
}

# "x y" of the notice's OK button in the UI dump on stdin (the AlertDialog's
# positive button is android:id/button1; its text is the fallback).
notice_ok_center() {
  python3 -c '
import re, sys
xml = sys.stdin.read()
nodes = re.findall(r"<node [^>]*>", xml)
def centre(n):
    b = re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", n)
    if b:
        x1, y1, x2, y2 = map(int, b.groups())
        return "%d %d" % ((x1 + x2) // 2, (y1 + y2) // 2)
for pick in (lambda n: "android:id/button1" in n, lambda n: re.search(r"\btext=\"OK\"", n)):
    for n in nodes:
        if pick(n):
            c = centre(n)
            if c:
                print(c)
                sys.exit(0)
'
}

# Keep BOTH launches: clearing logcat on relaunch discarded the evidence that
# distinguishes a real crash/OS kill from a failed am-start or test timing bug.
launch() {
  LAUNCH_NO=$((LAUNCH_NO + 1))
  if ! adb shell am start -W -n "$PKG/$ACTIVITY" > "$OUT/launch-$LAUNCH_NO.log" 2>&1; then
    echo "::error::ArenaPilot am start failed (launch $LAUNCH_NO)"; STATUS=1
  elif grep -Eq 'Error:|Exception|Status: timeout' "$OUT/launch-$LAUNCH_NO.log"; then
    echo "::error::ArenaPilot am start reported an error (launch $LAUNCH_NO)"; STATUS=1
  fi
  cp "$OUT/launch-$LAUNCH_NO.log" "$OUT/launch.log"
}

snapshot_launch() {
  local phase="$1" pid
  adb logcat -d > "$OUT/$phase-logcat.txt" 2>/dev/null || true
  adb shell dumpsys activity exit-info "$PKG" > "$OUT/$phase-exit-info.txt" 2>&1 || true
  adb shell dumpsys activity activities > "$OUT/$phase-activities.txt" 2>&1 || true
  pid=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
  printf '%s\n' "$pid" > "$OUT/$phase-pid.txt"
  if [[ "$pid" =~ ^[0-9]+([[:space:]][0-9]+)*$ ]]; then
    echo "::notice::ArenaPilot $phase: process alive (pid=$pid)"
  else
    echo "::error::ArenaPilot $phase: app process is not alive; exit-info and launch logs saved"
    STATUS=1
    # WHY it died, inline (annotations are the readable channel; artifacts
    # need a download): the exit-info reason plus any fatal/crash tail,
    # capped and masked.
    local why
    why=$(adb shell dumpsys activity exit-info "$PKG" 2>/dev/null \
      | grep -aiE 'reason=|processName' | tail -6 | tr -d '\r' | cut -c1-160)
    local fatal
    fatal=$(adb logcat -d 2>/dev/null | grep -a -A22 "FATAL EXCEPTION" | tail -26 \
      | sed -E 's/[A-Za-z0-9_-]{40,}/<opaque>/g' | cut -c1-180)
    local body=""
    [ -n "$why" ] && body="exit-info: $why"
    [ -n "$fatal" ] && body="${body:+$body || }fatal: $fatal"
    [ -n "$body" ] && echo "::error::ArenaPilot $phase death evidence: $(printf '%s' "$body" | sed ':a;N;$!ba;s/\n/%0A/g' | cut -c1-3000)"
  fi
}

# Polls (up to $NOTICE_WAIT s) until the notice is on screen. The notice appears
# once the launch screen has played: at the latest when the app's own 18 s cap
# reveals the page. Prints the UI dump that contained it; returns 1 if it never came.
wait_for_notice() {
  local waited=0 dump
  while :; do
    dump=$(ui_dump) && grep -q "$NOTICE_TEXT" <<<"$dump" && { printf '%s' "$dump"; return 0; }
    [ "$waited" -ge "$NOTICE_WAIT" ] && return 1
    sleep 3; waited=$((waited + 3))
  done
}

echo "== launch $PKG/$ACTIVITY =="
adb logcat -c || true
launch
# The app caps its own launch screen at 18 s; give the engine a moment after.
sleep "$BOOT_WAIT"
snapshot_launch first-boot

adb shell screencap -p /sdcard/smoke.png >/dev/null 2>&1
adb pull /sdcard/smoke.png "$OUT/screen.png" >/dev/null 2>&1 || true

# ── 3. the independence notice ───────────────────────────────────────────────
echo "== independence notice =="
if dump=$(wait_for_notice); then
  printf '%s' "$dump" > "$OUT/ui-first.xml"
  echo "notice shown on first launch"
  xy=$(notice_ok_center <<<"$dump")
  if [ -n "$xy" ]; then
    # shellcheck disable=SC2086
    adb shell input tap $xy
    sleep 2
    adb shell screencap -p /sdcard/smoke-accepted.png >/dev/null 2>&1
    adb pull /sdcard/smoke-accepted.png "$OUT/screen-accepted.png" >/dev/null 2>&1 || true
    if ! after=$(ui_dump); then
      echo "::warning::could not read the UI after OK — dismissal unverified"
      [ "$STRICT" = "1" ] && STATUS=1
    elif grep -q "$NOTICE_TEXT" <<<"$after"; then
      echo "::error::the notice is still on screen after tapping OK"; STATUS=1
    else
      printf '%s' "$after" > "$OUT/ui-accepted.xml"   # the native layer once the dialog is gone
      echo "notice accepted"
      echo "::notice::ArenaPilot: first-launch notice shown, accepted with OK"
    fi
  else
    echo "::error::the notice has no OK button to tap"; STATUS=1
  fi
elif ui_dump >/dev/null; then
  echo "::error::ArenaPilot did not show its independence notice on the first launch"; STATUS=1
else
  echo "::warning::could not read the UI (uiautomator never became idle) — the notice is unverified"
  [ "$STRICT" = "1" ] && STATUS=1
fi

# Second launch: "seen" was recorded on dismissal, so nothing must come back.
echo "== second launch (the notice must not return) =="
snapshot_launch first-end
adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
launch
sleep "$BOOT_WAIT"
snapshot_launch second-boot
if [ -s "$OUT/second-boot-pid.txt" ] && grep -qE "[0-9]" "$OUT/second-boot-pid.txt" && dump2=$(ui_dump); then
  printf '%s' "$dump2" > "$OUT/ui-second.xml"
  if grep -q "$NOTICE_TEXT" <<<"$dump2"; then
    echo "::error::the notice came back on the second launch — 'seen' was not persisted"; STATUS=1
  else
    echo "no notice on the second launch"
    echo "::notice::ArenaPilot: no notice on the second launch (seen flag persisted)"
  fi
else
    echo "::warning::could not read the UI after the second launch — persistence unverified"
    [ "$STRICT" = "1" ] && STATUS=1
fi

adb shell screencap -p /sdcard/smoke2.png >/dev/null 2>&1
adb pull /sdcard/smoke2.png "$OUT/screen2.png" >/dev/null 2>&1 || true
adb logcat -d > "$OUT/logcat.txt" 2>/dev/null || true

# ── 4. liveness, crashes, engine ─────────────────────────────────────────────
echo "== checks =="
if adb shell pidof "$PKG" > "$OUT/pid.txt" 2>/dev/null && [ -s "$OUT/pid.txt" ]; then
  echo "process alive: $(cat "$OUT/pid.txt")"
else
  echo "::error::app process is not alive after launch (crash during startup?)"
  STATUS=1
fi

# A UiAutomation helper can crash while the APK is healthy. Attribute fatal
# records by process identity/PID rather than failing on every global FATAL.
if ! python3 android/ci/crash_check.py "$OUT/logcat.txt" "$PKG" \
    --pid-file "$OUT/first-boot-pid.txt" --pid-file "$OUT/second-boot-pid.txt" --pid-file "$OUT/pid.txt"; then
  STATUS=1
fi

# Engine markers — page load can legitimately be the login/WAF screen inside
# CI, so a missing marker is a warning, not a failure (report-only job).
if grep -q "Official WebView loaded\|injected.js done\|engine already present" "$OUT/logcat.txt"; then
  echo "engine markers present"
else
  echo "::warning::engine markers not in logcat — the page may still be the login/WAF screen in CI"
fi

# Which site did the app actually open? The launch log prints every committed URL.
if grep -Eq "Official WebView loaded: https://(www\.)?arena\.ai" "$OUT/logcat.txt"; then
  echo "ArenaPilot opened arena.ai"
  echo "::notice::ArenaPilot opened arena.ai"
else
  echo "::warning::no arena.ai page load in logcat — offline emulator, or a challenge page that never committed"
fi
if grep -q "Official WebView loaded: https://chat\.deepseek\.com" "$OUT/logcat.txt"; then
  echo "::error::ArenaPilot navigated to chat.deepseek.com — its site profile is wrong"; STATUS=1
fi

# ── 5. did the ENGINE come up on the page? (informational — never a failure) ──
# The launch screen lifts as soon as the engine's UI is up; if it only lifted at its
# own 18 s cap, the engine never signalled ready on this page.
echo "== engine runtime facts =="
fact() { grep -aq "$1" "$OUT/logcat.txt" && echo yes || echo no; }
UI_READY=$(fact "Engine UI ready")
CAP=$(fact "Launch screen cap reached")
INJ=$(fact "injected.js done")
echo "engine UI ready: $UI_READY | launch-screen cap reached: $CAP | injected.js done: $INJ"
echo "::notice::ArenaPilot runtime: engine UI ready=$UI_READY, launch-screen cap reached=$CAP, injected.js done=$INJ"
if [ "$UI_READY" = "no" ] && [ "$CAP" = "yes" ]; then
  echo "::warning::ArenaPilot: the launch screen only lifted at its 18 s cap — the engine UI never signalled ready on the page"
fi

# Page JavaScript errors, first few distinct ones, long opaque strings masked.
ERRS=$(grep -a "CONSOLE" "$OUT/logcat.txt" 2>/dev/null | grep -aE "Uncaught|\[SDS|\[SuperDeepSeek|\[BDS" \
  | sed -E 's/[A-Za-z0-9_-]{30,}/<opaque>/g' | cut -c1-230 | sort -u | head -5)
if [ -n "$ERRS" ]; then
  echo "page console errors / engine warnings:"; echo "$ERRS"
  echo "::warning::ArenaPilot page console: $(printf '%s' "$ERRS" | sed ':a;N;$!ba;s/\n/%0A/g')"
else
  echo "::notice::ArenaPilot page console: no uncaught errors or engine warnings in logcat"
fi

# ── 6. ArenaPilot: look INSIDE the page, over the WebView's DevTools socket ───
# Only a debug build exposes the socket (BuildConfig.DEBUG), which is what CI installs.
# What the engine mounted, the "+" sheet opened with a real pointer click, the DOM an
# anonymous visitor gets and the page-load traffic: android/ci/cdp_probe.mjs reports
# them as annotations and as cdp-capture.json. Required when SMOKE_STRICT=1.
echo "== CDP probe =="
DEVTOOLS_PID=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' | awk '{print $1}')
if [ -n "$DEVTOOLS_PID" ] && adb forward tcp:9222 "localabstract:webview_devtools_remote_$DEVTOOLS_PID" >/dev/null 2>&1; then
  if ! timeout 240 node android/ci/cdp_probe.mjs --port 9222 --out "$OUT" --capture tools/arena-capture/capture.js --required "$STRICT"; then
    echo "::warning::the CDP probe did not finish or its runtime gate failed"
    [ "$STRICT" = "1" ] && STATUS=1
  fi
  if [ "${SMOKE_NATIVE_SANDBOX:-0}" = "1" ]; then
    if [ "$STATUS" -ne 0 ]; then
      echo "::error::Native sandbox smoke refused: launch/runtime/packaging gate failed"
    else
      # Opt-in trace for this fresh debug emulator only; outside the guest
      # root, with no production setting or JavascriptInterface added.
      if [ "${SMOKE_PROOT_TRACE:-0}" = "1" ]; then
        adb shell run-as "$PKG" mkdir -p no_backup/sandbox
        adb shell "run-as $PKG sh -c 'echo 9 > no_backup/sandbox/.ci-proot-trace'"
      else
        adb shell run-as "$PKG" rm -f no_backup/sandbox/.ci-proot-trace
      fi
      if ! timeout 380 node android/ci/sandbox-smoke.mjs; then
        echo "::error::Native sandbox execution failed or timed out"; STATUS=1
      fi
      adb shell run-as "$PKG" rm -f no_backup/sandbox/.ci-proot-trace
    fi
  fi
  if [ "${ARENA_LIVE_MESSAGE:-false}" = "true" ]; then
    if [ "$STATUS" -ne 0 ]; then
      echo "::error::Live message refused: native launch gate failed"
    elif ! timeout 140 node android/ci/arena-live-smoke.mjs; then
      echo "::error::Anonymous live chat is unverified (see sanitized summary)"; STATUS=1
    fi
  fi
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
else
  echo "::warning::no WebView devtools socket for pid '${DEVTOOLS_PID}' — the CDP probe was skipped"
  [ "$STRICT" = "1" ] && STATUS=1
fi

echo "smoke done (ArenaPilot, status=$STATUS) — artifacts in $OUT"
ls -la "$OUT"
exit $STATUS
