package com.superdeepseek.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pure decision tests for [MainFrameTracker].
 *
 * The URLs come from [Sites.ACTIVE] rather than being hardcoded: main-frame
 * tracking and bridge trust mean exactly the same thing for DeepSeek and for
 * arena.ai, so these tests hold for BOTH profiles instead of only for the one that
 * happens to be running. Which hosts count as the site is pinned separately, per
 * profile, in [SiteTest].
 */
class MainFrameTrackerTest {

    private val site = Sites.ACTIVE

    /** The site's home page. */
    private val chatHome = site.baseUrl

    /** Any other page on the site — trust is host-based, so the path is arbitrary. */
    private val chatPage = site.baseUrl + "a/chat/s/abc"

    /** The look-alike the old `url.contains(host)` check let through. */
    private val lookAlike = "https://evil.example.com/?next=${site.host}"

    private val foreign = "https://evil.example.com/portal"

    @Test
    fun `matching URLs are the main frame`() {
        assertTrue(MainFrameTracker.isMainFrame(chatPage, chatPage))
    }

    @Test
    fun `fragment differences are still the main frame`() {
        assertTrue(MainFrameTracker.isMainFrame("$chatPage#msg-42", chatPage))
        assertTrue(MainFrameTracker.isMainFrame(chatPage, "$chatPage#msg-42"))
    }

    @Test
    fun `a different URL is a subframe`() {
        assertFalse(MainFrameTracker.isMainFrame("https://accounts.google.com/o/oauth2/v2/auth", chatPage))
        assertFalse(MainFrameTracker.isMainFrame(chatPage, foreign))
    }

    @Test
    fun `first load with no WebView URL is the main frame`() {
        assertTrue(MainFrameTracker.isMainFrame(chatHome, null))
        assertTrue(MainFrameTracker.isMainFrame(chatHome, ""))
        assertFalse(MainFrameTracker.isMainFrame(null, chatHome))
        assertFalse(MainFrameTracker.isMainFrame("", chatHome))
    }

    @Test
    fun `trust follows the WebView URL when the callback is a subframe`() {
        // Foreign iframe on the chat page: stay trusted.
        assertTrue(MainFrameTracker.trustedForPage(
            "https://accounts.google.com/o/oauth2/v2/auth",
            chatPage,
        ))
        // Chat iframe on a foreign page: stay untrusted.
        assertFalse(MainFrameTracker.trustedForPage(chatPage, foreign))
    }

    @Test
    fun `trust follows the callback when it is the main frame`() {
        assertTrue(MainFrameTracker.trustedForPage(chatPage, chatPage))
        assertFalse(MainFrameTracker.trustedForPage(lookAlike, lookAlike))
    }

    @Test
    fun `engine injection only for a trusted main frame`() {
        assertTrue(MainFrameTracker.shouldInjectEngine(chatPage, chatPage))
        // Subframe finish — even one on the chat site — never injects.
        assertFalse(MainFrameTracker.shouldInjectEngine(chatPage, chatHome))
        // The old `url.contains("<chat host>")` let this through.
        assertFalse(MainFrameTracker.shouldInjectEngine(lookAlike, lookAlike))
        assertFalse(MainFrameTracker.shouldInjectEngine(foreign, foreign))
        assertFalse(MainFrameTracker.shouldInjectEngine(null, null))
    }

    @Test
    fun `the other chat site is a foreign page`() {
        // Neither profile may treat the other site as its own.
        val other = if (site === Sites.ARENA) Sites.DEEPSEEK else Sites.ARENA
        assertFalse(MainFrameTracker.trustedForPage(other.baseUrl, other.baseUrl))
        assertFalse(MainFrameTracker.shouldInjectEngine(other.baseUrl, other.baseUrl))
    }
}
