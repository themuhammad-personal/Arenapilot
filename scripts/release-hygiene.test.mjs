// Cheap guards for release hygiene that the Kotlin unit tests cannot see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("package.json, package-lock.json and the gradle fallback share one version", () => {
  const pkg = JSON.parse(read("package.json")).version;
  const lock = JSON.parse(read("package-lock.json")).version;
  const gradle = read("android/app/build.gradle.kts").match(/\?: "(\d+\.\d+\.\d+)"/)?.[1];
  assert.equal(lock, pkg, "package-lock.json drifted from package.json");
  assert.equal(gradle, pkg, "build.gradle.kts fallback versionName drifted from package.json");
});

test("manifest does not let adb/cloud backup copy app data (MCP keys, sessions)", () => {
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /android:allowBackup="false"/);
});

test("late results of off-thread work never touch a destroyed Activity", () => {
  const src = read("android/app/src/main/java/com/arenadeck/app/MainActivity.kt");
  assert.match(
    src,
    /runOnUiThread \{ if \(!isFinishing && !isDestroyed\) deliverPageAction\(json\) \}/,
  );
});

test("the signing key is not in the repository and has no default password", async () => {
  const { execFileSync } = await import("node:child_process");
  const tracked = execFileSync("git", ["ls-files"], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.doesNotMatch(tracked, /\.(jks|keystore)$/m, "a keystore is tracked");
  const wf = read(".github/workflows/build-and-release-apk.yml");
  assert.doesNotMatch(wf, /secrets\.BDS_[A-Z_]+\s*\|\|/, "a signing secret has a literal fallback");
  for (const n of ["BDS_KEYSTORE", "BDS_KEYSTORE_PASSWORD", "BDS_KEY_ALIAS", "BDS_KEY_PASSWORD"]) {
    assert.match(wf, new RegExp(`secrets\\.${n}\\b`), `${n} must come from GitHub Secrets`);
  }
  assert.match(wf, /ffdd6e6acd136fc2a955f6aa7be0df3c851c671caaffb8cbc53c3397e698383c/, "v2.4.0 certificate pin is gone");
  const gradle = read("android/app/build.gradle.kts");
  assert.doesNotMatch(gradle, /"superdeepseek"/, "gradle carries a default key password");
});

test("the instrumented-test wrapper retries only dependency-resolution failures", () => {
  const sh = read("android/ci/run-connected-tests.sh");
  assert.match(sh, /Could not resolve all files for configuration/);
  assert.match(sh, /There were failing tests/);
});
