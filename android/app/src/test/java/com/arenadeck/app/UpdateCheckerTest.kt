package com.arenadeck.app

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * JVM tests for the update decision logic behind issue #157.
 *
 * These run against the real `org.json` implementation (Robolectric supplies the Android
 * runtime), so the asset and digest parsing is exercised with payloads shaped like the ones the
 * GitHub releases API actually returns.
 */
@RunWith(RobolectricTestRunner::class)
class UpdateCheckerTest {

    // ── Channel ──────────────────────────────────────────────────────────

    @Test
    fun `channel falls back to release for missing and unknown values`() {
        assertEquals(UpdateChannel.RELEASE, UpdateChannel.from(null))
        assertEquals(UpdateChannel.RELEASE, UpdateChannel.from(""))
        assertEquals(UpdateChannel.RELEASE, UpdateChannel.from("nightly"))
    }

    @Test
    fun `channel parsing is case and whitespace insensitive`() {
        assertEquals(UpdateChannel.BETA, UpdateChannel.from("beta"))
        assertEquals(UpdateChannel.BETA, UpdateChannel.from("  BETA  "))
        assertEquals(UpdateChannel.RELEASE, UpdateChannel.from("Release"))
    }

    @Test
    fun `release channel reads the tagged release endpoint`() {
        assertEquals(
                "/repos/o/r/releases/latest",
                releaseApiPath(UpdateChannel.RELEASE, "o", "r"),
        )
    }

    @Test
    fun `beta channel reads the releases list, never a fixed tag`() {
        // There is no rolling `latest` tag any more: CI publishes one tag per
        // version ("v2.0.0"), so a fixed tag would 404 the moment the version
        // moved — which is exactly how the beta channel went dead. The list is
        // the only address that keeps working across version bumps.
        val path = releaseApiPath(UpdateChannel.BETA, "o", "r")
        assertEquals("/repos/o/r/releases?per_page=1", path)
        assertTrue("the beta channel must be a list read", isReleaseListPath(path))
        assertFalse("no fixed tag", path.contains("/releases/tags/"))
    }

    @Test
    fun `the channel CI actually publishes to resolves`() {
        // CI publishes a normal (non-prerelease) versioned release with
        // make_latest: true, so the default channel is the one that finds it.
        assertEquals(
                "/repos/o/r/releases/latest",
                releaseApiPath(UpdateChannel.RELEASE, "o", "r"),
        )
        assertFalse(
                "the release path must not be a list read",
                isReleaseListPath(releaseApiPath(UpdateChannel.RELEASE, "o", "r")),
        )
    }

    // ── Version parsing ──────────────────────────────────────────────────

    @Test
    fun `version parsing tolerates a v prefix and a suffix`() {
        assertEquals(listOf(0, 1, 14), parseVersion("v0.1.14"))
        assertEquals(listOf(0, 1, 14), parseVersion("0.1.14"))
        assertEquals(listOf(0, 1, 14), parseVersion("v0.1.14-hotfix"))
        assertEquals(listOf(2), parseVersion("2"))
    }

    @Test
    fun `version parsing returns null when there is no number`() {
        // "latest" is the beta channel's tag. Null means unknown, never older.
        assertNull(parseVersion("latest"))
        assertNull(parseVersion(""))
        assertNull(parseVersion(null))
    }

    @Test
    fun `version comparison pads missing components`() {
        assertTrue(compareVersions(listOf(0, 1, 14), listOf(0, 1, 13)) > 0)
        assertTrue(compareVersions(listOf(0, 1, 13), listOf(0, 1, 14)) < 0)
        assertEquals(0, compareVersions(listOf(0, 1, 14), listOf(0, 1, 14)))
        assertEquals(0, compareVersions(listOf(1, 2), listOf(1, 2, 0)))
        assertTrue(compareVersions(listOf(1, 0, 0), listOf(0, 9, 9)) > 0)
    }

    // ── Asset selection ──────────────────────────────────────────────────

    private fun releaseAssets(): JSONArray =
            JSONArray(
                    """
                    [
                      {"name":"better-deepseek-chrome-v0.1.13.zip","state":"uploaded",
                       "browser_download_url":"https://example.test/chrome.zip"},
                      {"name":"better-deepseek-firefox-v0.1.13.zip","state":"uploaded",
                       "browser_download_url":"https://example.test/firefox.zip"},
                      {"name":"better-deepseek-latest.zip","state":"uploaded",
                       "browser_download_url":"https://example.test/source.zip"},
                      {"name":"better-deepseek-android-v0.1.13-signed.apk","state":"uploaded",
                       "browser_download_url":"https://example.test/app.apk"}
                    ]
                    """.trimIndent()
            )

    @Test
    fun `asset selection picks the apk CI actually publishes`() {
        val assets =
                JSONArray(
                        """
                        [{"name":"arenapilot-latest.apk","state":"uploaded",
                          "browser_download_url":"https://example.test/arenapilot-latest.apk"},
                         {"name":"arenapilot-latest.apk.sha256","state":"uploaded",
                          "browser_download_url":"https://example.test/arenapilot-latest.apk.sha256"}]
                        """.trimIndent()
                )

        assertEquals("arenapilot-latest.apk", pickApkAsset(assets)?.optString("name"))
    }

    @Test
    fun `the retired asset name is not what the updater looks for`() {
        // APK_ASSET_PREFIX/SUFFIX described a channel that no longer exists
        // (better-deepseek-android-*-signed.apk). Keeping them around is how the
        // updater silently stopped matching the real asset.
        assertTrue(APK_ASSET_PREFIX.startsWith("arenapilot"))
        assertEquals(".apk", APK_ASSET_SUFFIX)
    }

    @Test
    fun `asset selection picks the signed android apk and ignores the browser bundles`() {
        val asset = pickApkAsset(releaseAssets())

        assertEquals("better-deepseek-android-v0.1.13-signed.apk", asset?.optString("name"))
    }

    @Test
    fun `asset selection picks the beta apk name too`() {
        val assets =
                JSONArray(
                        """
                        [{"name":"better-deepseek-android-latest-signed.apk","state":"uploaded",
                          "browser_download_url":"https://example.test/beta.apk"}]
                        """.trimIndent()
                )

        assertEquals("better-deepseek-android-latest-signed.apk", pickApkAsset(assets)?.optString("name"))
    }

    @Test
    fun `asset selection skips assets that are not uploaded or lack a url`() {
        val assets =
                JSONArray(
                        """
                        [{"name":"better-deepseek-android-latest-signed.apk","state":"new",
                          "browser_download_url":"https://example.test/app.apk"},
                         {"name":"better-deepseek-android-v0.1.13-signed.apk","state":"uploaded",
                          "browser_download_url":""}]
                        """.trimIndent()
                )

        assertNull(pickApkAsset(assets))
    }

    @Test
    fun `asset selection handles a missing asset list`() {
        assertNull(pickApkAsset(null))
        assertNull(pickApkAsset(JSONArray("[]")))
    }

    // ── Digest parsing ───────────────────────────────────────────────────

    private val hex64 = "a".repeat(64)

    @Test
    fun `digest parsing accepts the sha256 form the api returns`() {
        assertEquals(hex64, parseSha256Digest("sha256:$hex64"))
        assertEquals(hex64, parseSha256Digest("SHA256:$hex64"))
    }

    @Test
    fun `digest parsing rejects anything that is not a sha256 hex string`() {
        assertNull(parseSha256Digest(null))
        assertNull(parseSha256Digest(""))
        // Older assets carry an empty digest field rather than a null one.
        assertNull(parseSha256Digest("sha256:"))
        assertNull(parseSha256Digest(hex64))
        assertNull(parseSha256Digest("md5:$hex64"))
        assertNull(parseSha256Digest("sha256:" + "a".repeat(63)))
        assertNull(parseSha256Digest("sha256:" + "z".repeat(64)))
    }

    // ── Update decisions ─────────────────────────────────────────────────

    private fun decide(
            channel: UpdateChannel,
            remoteVersionName: String?,
            installedVersionName: String? = "0.1.14",
            remoteBuildId: Long = 0L,
            installedBuildId: Long = 0L,
            remoteUploadedAtMillis: Long = 0L,
            installedLastUpdateTimeMillis: Long = 0L,
            remoteDigest: String? = null,
            declinedDigest: String? = null,
    ): UpdateDecision =
            decideUpdate(
                    channel = channel,
                    remoteVersionName = remoteVersionName,
                    installedVersionName = installedVersionName,
                    remoteBuildId = remoteBuildId,
                    installedBuildId = installedBuildId,
                    remoteUploadedAtMillis = remoteUploadedAtMillis,
                    installedLastUpdateTimeMillis = installedLastUpdateTimeMillis,
                    remoteDigest = remoteDigest,
                    declinedDigest = declinedDigest,
            )

    @Test
    fun `release channel offers a newer tagged version`() {
        val decision = decide(UpdateChannel.RELEASE, "v0.1.15")

        assertTrue(decision.available)
        assertEquals(REASON_NEWER_VERSION, decision.reason)
    }

    @Test
    fun `release channel stays quiet on the installed version`() {
        assertFalse(decide(UpdateChannel.RELEASE, "v0.1.14").available)
    }

    @Test
    fun `release channel never offers a downgrade`() {
        val decision = decide(UpdateChannel.RELEASE, "v0.1.13")

        assertFalse(decision.available)
        assertEquals(REASON_INSTALLED_NEWER, decision.reason)
    }

    @Test
    fun `release channel stays quiet when a version cannot be compared`() {
        assertEquals(REASON_NO_VERSION_INFO, decide(UpdateChannel.RELEASE, "latest").reason)
        assertEquals(REASON_NO_VERSION_INFO, decide(UpdateChannel.RELEASE, null).reason)
        assertEquals(
                REASON_NO_VERSION_INFO,
                decide(UpdateChannel.RELEASE, "v0.1.15", installedVersionName = null).reason,
        )
    }

    @Test
    fun `beta channel still honours a newer version`() {
        // A version bump outranks the timestamp heuristic on either channel.
        val decision = decide(UpdateChannel.BETA, "v0.1.15")

        assertTrue(decision.available)
        assertEquals(REASON_NEWER_VERSION, decision.reason)
    }

    @Test
    fun `beta channel offers a rebuild of the same version`() {
        // Every push to main rebuilds the same versionCode, so the upload time is the only
        // signal that a beta user is behind.
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteUploadedAtMillis = 2_000L,
                        installedLastUpdateTimeMillis = 1_000L,
                )

        assertTrue(decision.available)
        assertEquals(REASON_NEWER_BUILD, decision.reason)
    }

    @Test
    fun `beta channel stays quiet when the installed build is the newest`() {
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteUploadedAtMillis = 1_000L,
                        installedLastUpdateTimeMillis = 2_000L,
                )

        assertFalse(decision.available)
        assertEquals(REASON_UP_TO_DATE, decision.reason)
    }

    @Test
    fun `beta channel does not re-ask for a build the user dismissed`() {
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteUploadedAtMillis = 2_000L,
                        installedLastUpdateTimeMillis = 1_000L,
                        remoteDigest = hex64,
                        declinedDigest = hex64,
                )

        assertFalse(decision.available)
        assertEquals(REASON_DECLINED, decision.reason)
    }

    @Test
    fun `beta channel offers a build whose digest differs from the dismissed one`() {
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteUploadedAtMillis = 2_000L,
                        installedLastUpdateTimeMillis = 1_000L,
                        remoteDigest = "b".repeat(64),
                        declinedDigest = hex64,
                )

        assertTrue(decision.available)
    }

    @Test
    fun `beta channel stays quiet when either timestamp is missing`() {
        // Without both timestamps the rebuild heuristic cannot be trusted, so it must not fire.
        assertEquals(
                REASON_NO_TIMESTAMP,
                decide(
                                UpdateChannel.BETA,
                                "latest",
                                remoteUploadedAtMillis = 0L,
                                installedLastUpdateTimeMillis = 1_000L,
                        )
                        .reason,
        )
        assertEquals(
                REASON_NO_TIMESTAMP,
                decide(
                                UpdateChannel.BETA,
                                "latest",
                                remoteUploadedAtMillis = 2_000L,
                                installedLastUpdateTimeMillis = 0L,
                        )
                        .reason,
        )
    }

    @Test
    fun `beta channel never offers a downgrade`() {
        val decision = decide(UpdateChannel.BETA, "v0.1.13")

        assertFalse(decision.available)
        assertEquals(REASON_INSTALLED_NEWER, decision.reason)
    }

    // ── Build numbers: the clock-free beta signal ────────────────────────

    @Test
    fun `beta channel offers a newer CI build number`() {
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteBuildId = 121L,
                        installedBuildId = 120L,
                )

        assertTrue(decision.available)
        assertEquals(REASON_NEWER_BUILD_ID, decision.reason)
    }

    @Test
    fun `beta channel stays quiet on the same CI build number`() {
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteBuildId = 120L,
                        installedBuildId = 120L,
                )

        assertFalse(decision.available)
        assertEquals(REASON_UP_TO_DATE, decision.reason)
    }

    @Test
    fun `beta channel never offers an older CI build number`() {
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteBuildId = 119L,
                        installedBuildId = 120L,
                )

        assertFalse(decision.available)
        assertEquals(REASON_UP_TO_DATE, decision.reason)
    }

    @Test
    fun `build numbers outrank the upload-time heuristic`() {
        // The whole point of the ids: a clock that disagrees with GitHub must not hide a build.
        // The timestamps here say "already current" while the counters say "one build behind".
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteBuildId = 121L,
                        installedBuildId = 120L,
                        remoteUploadedAtMillis = 1_000L,
                        installedLastUpdateTimeMillis = 9_999L,
                )

        assertTrue(decision.available)
        assertEquals(REASON_NEWER_BUILD_ID, decision.reason)
    }

    @Test
    fun `a build number of zero falls back to the upload-time heuristic`() {
        // Releases published before the ids existed, and APKs built outside CI, carry no id.
        assertEquals(
                REASON_NEWER_BUILD,
                decide(
                                UpdateChannel.BETA,
                                "latest",
                                remoteBuildId = 0L,
                                installedBuildId = 120L,
                                remoteUploadedAtMillis = 2_000L,
                                installedLastUpdateTimeMillis = 1_000L,
                        )
                        .reason,
        )
        assertEquals(
                REASON_NEWER_BUILD,
                decide(
                                UpdateChannel.BETA,
                                "latest",
                                remoteBuildId = 121L,
                                installedBuildId = 0L,
                                remoteUploadedAtMillis = 2_000L,
                                installedLastUpdateTimeMillis = 1_000L,
                        )
                        .reason,
        )
    }

    @Test
    fun `a declined build stays declined even when the build number is newer`() {
        val decision =
                decide(
                        UpdateChannel.BETA,
                        "latest",
                        remoteBuildId = 121L,
                        installedBuildId = 120L,
                        remoteDigest = hex64,
                        declinedDigest = hex64,
                )

        assertFalse(decision.available)
        assertEquals(REASON_DECLINED, decision.reason)
    }

    @Test
    fun `release channel offers a newer CI build of the same version`() {
        // Every main build republishes the same version as the latest release.
        val decision =
                decide(
                        UpdateChannel.RELEASE,
                        "v0.1.14",
                        remoteBuildId = 121L,
                        installedBuildId = 120L,
                )

        assertTrue(decision.available)
        assertEquals(REASON_NEWER_BUILD_ID, decision.reason)
    }

    @Test
    fun `release channel stays quiet on the same or an older CI build`() {
        assertEquals(REASON_UP_TO_DATE, decide(UpdateChannel.RELEASE, "v0.1.14", remoteBuildId = 120L, installedBuildId = 120L).reason)
        assertEquals(REASON_UP_TO_DATE, decide(UpdateChannel.RELEASE, "v0.1.14", remoteBuildId = 119L, installedBuildId = 120L).reason)
    }

    @Test
    fun `release channel honours Later for a newer CI build`() {
        val decision = decide(
                UpdateChannel.RELEASE, "v0.1.14", remoteBuildId = 121L, installedBuildId = 120L,
                remoteDigest = "abc", declinedDigest = "abc",
        )
        assertEquals(REASON_DECLINED, decision.reason)
    }

    @Test
    fun `release channel never guesses from timestamps`() {
        val decision = decide(
                UpdateChannel.RELEASE, "v0.1.14",
                remoteUploadedAtMillis = 2_000L, installedLastUpdateTimeMillis = 1_000L,
        )
        assertFalse(decision.available)
    }

    // ── Build id parsing ─────────────────────────────────────────────────

    @Test
    fun `build id parsing reads the marker out of a release body`() {
        val body =
                """
                This release contains the latest automated build from the `main` branch.

                <!-- bds-build-id: 4211 -->
                """.trimIndent()

        assertEquals(4211L, parseBuildId(body))
    }

    @Test
    fun `build id parsing tolerates spacing and surrounding prose`() {
        assertEquals(7L, parseBuildId("<!--bds-build-id:7-->"))
        assertEquals(7L, parseBuildId("prefix\n<!-- bds-build-id:   7 -->\nsuffix"))
    }

    @Test
    fun `build id parsing returns zero when the marker is absent or malformed`() {
        assertEquals(0L, parseBuildId(null))
        assertEquals(0L, parseBuildId(""))
        assertEquals(0L, parseBuildId("no marker here"))
        assertEquals(0L, parseBuildId("<!-- bds-build-id: -->"))
        assertEquals(0L, parseBuildId("<!-- bds-build-id: abc -->"))
    }

    @Test
    fun `build id parsing falls back to the visible Build line of the release notes`() {
        val body = "### Super DeepSeek for Android\n\n**Version:** `1.8.3`\n**Build:** `412`\n**Commit:** `abc`"
        assertEquals(412L, parseBuildId(body))
        // The hidden marker wins when both are present.
        assertEquals(9L, parseBuildId("<!-- bds-build-id: 9 -->\n**Build:** `412`"))
        assertEquals(0L, parseBuildId("**Build:** `n/a`"))
    }

    @Test
    fun `download completeness checks the size only when the asset reports one`() {
        assertTrue(isCompleteDownload(100L, 100L))
        assertFalse(isCompleteDownload(60L, 100L))
        assertFalse(isCompleteDownload(120L, 100L))
        assertTrue(isCompleteDownload(60L, 0L))
    }

    // ── Timestamp parsing ────────────────────────────────────────────────

    @Test
    fun `iso8601 parsing converts the api timestamp to epoch millis`() {
        assertEquals(1_789_562_149_000L, parseIso8601Millis("2026-09-16T12:35:49Z"))
        assertEquals(1_767_323_045_000L, parseIso8601Millis("2026-01-02T03:04:05Z"))
    }

    @Test
    fun `iso8601 parsing returns zero for malformed input`() {
        assertEquals(0L, parseIso8601Millis(null))
        assertEquals(0L, parseIso8601Millis(""))
        assertEquals(0L, parseIso8601Millis("2026-09-16"))
        assertEquals(0L, parseIso8601Millis("2026-09-16T12:35:49.000Z"))
        assertEquals(0L, parseIso8601Millis("not-a-date"))
    }

    @Test
    fun `a full api payload yields the expected update`() {
        // End-to-end shape check: the release body plus the asset list, as the checker reads them.
        val release =
                JSONObject(
                        """
                        {
                          "tag_name": "v0.1.15",
                          "draft": false,
                          "prerelease": false,
                          "assets": [
                            {"name":"better-deepseek-android-v0.1.15-signed.apk","state":"uploaded",
                             "browser_download_url":"https://example.test/app.apk",
                             "digest":"sha256:$hex64",
                             "size":6390952,
                             "updated_at":"2026-09-16T12:35:49Z"}
                          ]
                        }
                        """.trimIndent()
                )

        val asset = pickApkAsset(release.optJSONArray("assets"))!!

        assertEquals(
                "0.1.15",
                release.optString("tag_name").removePrefix("v"),
        )
        assertEquals(hex64, parseSha256Digest(asset.optString("digest")))
        assertEquals(1_789_562_149_000L, parseIso8601Millis(asset.optString("updated_at")))
        assertTrue(decide(UpdateChannel.RELEASE, "v0.1.15").available)
    }
}
