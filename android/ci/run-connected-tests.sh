#!/usr/bin/env bash
# Runs the instrumented tests on the booted emulator.
#
# Gradle resolves the Unified Test Platform artifacts (the "ddmlib" device provider and its
# Kotlin stdlib) from Google/Maven Central only when connectedDebugAndroidTest first runs.
# A transient 404/timeout there ("Could not find org.jetbrains.kotlin:kotlin-stdlib-common")
# fails the job although no test ran. This wrapper retries ONCE, and only when the log shows
# that kind of dependency-resolution failure. A real test failure is never retried: it is
# reported by the first run and fails the job.
set -uo pipefail
cd "$(dirname "$0")/.."

LOG="${RUNNER_TEMP:-/tmp}/connected-tests.log"
run() { ./gradlew --no-daemon connectedDebugAndroidTest 2>&1 | tee "$LOG"; return "${PIPESTATUS[0]}"; }

if run; then exit 0; fi

if grep -qE "Could not resolve all files for configuration|Could not find org\.|Could not GET|Read timed out|Connection reset" "$LOG" \
   && ! grep -qE "There were failing tests|Tests on .* failed|FAILED$" "$LOG"; then
  echo "::warning::connectedDebugAndroidTest could not resolve a dependency (infrastructure, not a test failure) — retrying once"
  sleep 20
  run
  exit $?
fi
exit 1
