package com.superdeepseek.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The native site profile (Site.kt): which chat site a build wraps.
 *
 * Plain JVM — [SiteProfile], [Sites], [ChatUrls] and [composerLookupJs] are pure
 * values/functions, so both profiles are pinned here whatever SITE_ID is. That is
 * the point of passing the site explicitly instead of reading [Sites.ACTIVE]:
 * a test must never change meaning with the variant it runs in.
 */
class SiteTest {

    // ── host matching ───────────────────────────────────────────────────────

    @Test
    fun `deepseek trusts exactly its chat host`() {
        val s = Sites.DEEPSEEK
        assertTrue(s.isSiteHost("chat.deepseek.com"))
        assertTrue(s.isSiteHost("CHAT.DeepSeek.COM"))
        // A trailing dot is the same FQDN.
        assertTrue(s.isSiteHost("chat.deepseek.com."))
        assertFalse(s.isSiteHost("www.chat.deepseek.com"))
        assertFalse(s.isSiteHost("deepseek.com"))
        assertFalse(s.isSiteHost("chat.deepseek.com.evil.example"))
        assertFalse(s.isSiteHost("evil.example/?chat.deepseek.com"))
        assertFalse(s.isSiteHost(""))
        assertFalse(s.isSiteHost(null))
    }

    @Test
    fun `arena trusts both of its hosts and nothing that merely contains them`() {
        val s = Sites.ARENA
        assertTrue(s.isSiteHost("arena.ai"))
        assertTrue(s.isSiteHost("www.arena.ai"))
        assertFalse(s.isSiteHost("lmarena.ai"))
        assertFalse(s.isSiteHost("arena.ai.evil.example"))
        assertFalse(s.isSiteHost("notarena.ai"))
        assertFalse(s.isSiteHost(""))
        assertFalse(s.isSiteHost(null))
    }

    @Test
    fun `no site claims the other one's host`() {
        assertFalse(Sites.DEEPSEEK.isSiteHost("arena.ai"))
        assertFalse(Sites.DEEPSEEK.isSiteHost("www.arena.ai"))
        assertFalse(Sites.ARENA.isSiteHost("chat.deepseek.com"))
    }

    @Test
    fun `in-app hosts cover the site and its subdomains only`() {
        assertTrue(Sites.ARENA.isInAppHost("arena.ai"))
        assertTrue(Sites.ARENA.isInAppHost("cdn.arena.ai"))
        assertFalse(Sites.ARENA.isInAppHost("arena.ai.evil.example"))
        assertFalse(Sites.ARENA.isInAppHost("deepseek.com"))
        assertTrue(Sites.DEEPSEEK.isInAppHost("api-docs.deepseek.com"))
        assertFalse(Sites.DEEPSEEK.isInAppHost("arena.ai"))
    }

    // ── bridge trust ────────────────────────────────────────────────────────

    @Test
    fun `bridge trust is https plus the site host, userinfo never allowed`() {
        assertTrue(isTrustedBridgeUrl("https://arena.ai/text/direct?model_a=x", Sites.ARENA))
        assertTrue(isTrustedBridgeUrl("https://www.arena.ai/c/abc", Sites.ARENA))
        assertFalse(isTrustedBridgeUrl("http://arena.ai/", Sites.ARENA))
        assertFalse(isTrustedBridgeUrl("https://user@arena.ai/", Sites.ARENA))
        assertFalse(isTrustedBridgeUrl("https://arena.ai.evil.example/", Sites.ARENA))
        assertFalse(isTrustedBridgeUrl("https://chat.deepseek.com/", Sites.ARENA))
        assertFalse(isTrustedBridgeUrl(null, Sites.ARENA))
    }

    // ── conversation restore ────────────────────────────────────────────────

    @Test
    fun `arena conversations are restorable and rewritten to the canonical host`() {
        assertEquals("https://arena.ai/c/abc123", ChatUrls.restorable("https://arena.ai/c/abc123", Sites.ARENA))
        // The www alias is restored as the canonical host, so the WebView never
        // ends up on a second origin for the same conversation.
        assertEquals("https://arena.ai/c/abc123", ChatUrls.restorable("https://www.arena.ai/c/abc123", Sites.ARENA))
    }

    @Test
    fun `everything else on arena opens a new direct chat`() {
        listOf(
            null,
            "",
            "https://arena.ai/",
            "https://arena.ai/text/direct",
            "https://arena.ai/text/direct?model_a=x",
            "https://arena.ai/agent",
            "https://arena.ai/analytics/side-by-side?model_a=x&model_b=y",
            "http://arena.ai/c/abc",
            "https://arena.ai/c/abc?x=1",
            "https://arena.ai/c/abc#frag",
            "https://user@arena.ai/c/abc",
            "https://arena.ai:8443/c/abc",
            "https://evil.example/c/abc",
            "https://arena.ai/c/" + "a".repeat(81),
            "https://chat.deepseek.com/a/chat/s/abc",
        ).forEach { assertNullMsg(it, ChatUrls.restorable(it, Sites.ARENA)) }
    }

    @Test
    fun `deepseek restore rules are unchanged`() {
        assertEquals(
            "https://chat.deepseek.com/a/chat/s/abc",
            ChatUrls.restorable("https://chat.deepseek.com/a/chat/s/abc", Sites.DEEPSEEK),
        )
        assertNullMsg("https://arena.ai/c/abc", ChatUrls.restorable("https://arena.ai/c/abc", Sites.DEEPSEEK))
    }

    // ── site wiring ────────────────────────────────────────────────────────

    @Test
    fun `the active site follows SITE_ID`() {
        val expected = if (BuildConfig.SITE_ID == "arena") "arena" else "deepseek"
        assertEquals(expected, Sites.ACTIVE.id)
        // Every build is one of the two known sites — never an empty profile.
        assertTrue(Sites.ACTIVE === Sites.DEEPSEEK || Sites.ACTIVE === Sites.ARENA)
        assertTrue(Sites.ACTIVE.hosts.isNotEmpty())
        assertTrue(Sites.ACTIVE.baseUrl.startsWith("https://" + Sites.ACTIVE.host))
        assertTrue(Sites.ACTIVE.newChatUrl.startsWith("https://" + Sites.ACTIVE.host))
    }

    @Test
    fun `only the profile with a release channel self-updates`() {
        // The updater reads this repo's releases, which carry the Super DeepSeek
        // APK (applicationId com.superdeepseek.app) — installing that over
        // com.arenadeck.app would not be an update at all.
        assertTrue(Sites.DEEPSEEK.selfUpdateEnabled)
        assertFalse(Sites.ARENA.selfUpdateEnabled)
    }

    @Test
    fun `the new-chat target is a direct chat on arena`() {
        assertEquals("https://chat.deepseek.com/", Sites.DEEPSEEK.newChatUrl)
        assertEquals("https://arena.ai/text/direct", Sites.ARENA.newChatUrl)
    }

    // ── composer lookup shared with UiPolish ────────────────────────────────

    @Test
    fun `composer lookup follows the site and quotes selectors safely`() {
        val ds = composerLookupJs(Sites.DEEPSEEK)
        assertEquals(
            "document.querySelector('textarea#chat-input')||document.querySelector('.ds-textarea textarea')",
            ds,
        )
        val arena = composerLookupJs(Sites.ARENA)
        assertTrue(arena.contains("document.querySelector('textarea[name=\"message\"]')"))
        assertTrue(arena.contains("document.querySelector('main textarea')"))
        assertFalse(arena.contains("chat-input"))
        // Extra fallbacks come last, so a site selector always wins.
        val withFallback = composerLookupJs(Sites.ARENA, listOf("textarea"))
        assertTrue(withFallback.endsWith("||document.querySelector('textarea')"))
        assertTrue(withFallback.indexOf("name=\"message\"") < withFallback.indexOf("'textarea')"))
    }

    private fun assertNullMsg(value: String?, actual: String?) {
        if (actual != null) throw AssertionError("expected null for <$value> but got <$actual>")
    }
}
