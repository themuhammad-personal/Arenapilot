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
