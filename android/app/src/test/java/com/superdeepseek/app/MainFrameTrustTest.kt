package com.superdeepseek.app

import android.webkit.WebView
import android.widget.FrameLayout
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Bridge trust must follow the MAIN frame only.
 *
 * Bug: `onPageStarted` set `bridge.trustedPage = isTrustedBridgeUrl(url)` for
 * every callback — including iframe navigations, which WebViewClient can fire
 * on several WebView versions. A foreign OAuth/hCaptcha iframe on the DeepSeek
 * page killed the bridge; a DeepSeek iframe on a foreign page granted it.
 *
 * These tests drive the REAL [MainActivity] WebViewClient callbacks and observe
 * the live [WebViewBridge.trustedPage] flag. They fail on the old behaviour and
 * pass after [MainFrameTracker]; they deliberately do not call the tracker
 * directly, so what is asserted here is the callback path the app really runs.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MainFrameTrustTest {

    private lateinit var activity: MainActivity
    private lateinit var webView: WebView
    private lateinit var bridge: WebViewBridge

    /**
     * The site THIS variant wraps. Trust follows the main frame's host, so these
     * tests mean the same thing for DeepSeek and for arena.ai — deriving the URLs
     * keeps them true for both profiles (see [SiteTest] for the per-profile host
     * rules).
     */
    private val site = Sites.ACTIVE
    private val chatPage = site.baseUrl + "a/chat/s/abc"
    private val lookAlike = "https://evil.example.com/?next=${site.host}"

    @Before
    fun setUp() {
        activity = Robolectric
            .buildActivity(MainActivity::class.java)
            .create()
            .start()
            .resume()
            .get()
        webView = findWebView(activity)
        bridge = bridgeOf(activity)
    }

    @Test
    fun `foreign iframe on the chat page must not revoke the bridge`() {
        webView.loadUrl(chatPage)
        webView.webViewClient.onPageStarted(webView, chatPage, null)
        assertTrue("main frame chat page starts trusted", bridge.trustedPage)

        // An OAuth iframe navigates while the page is still the chat site.
        webView.webViewClient.onPageStarted(webView, "https://accounts.google.com/o/oauth2/v2/auth", null)
        assertTrue("a subframe navigation must not revoke the bridge", bridge.trustedPage)
    }

    @Test
    fun `chat iframe on a foreign page must not grant the bridge`() {
        webView.loadUrl("https://evil.example.com/portal")
        webView.webViewClient.onPageStarted(webView, "https://evil.example.com/portal", null)
        assertFalse("foreign page starts untrusted", bridge.trustedPage)

        // The foreign page embeds a chat-site iframe.
        webView.webViewClient.onPageStarted(webView, chatPage, null)
        assertFalse("a chat-site subframe must not grant the bridge", bridge.trustedPage)
    }

    @Test
    fun `main frame navigating away revokes the bridge`() {
        webView.loadUrl(chatPage)
        webView.webViewClient.onPageStarted(webView, chatPage, null)
        assertTrue(bridge.trustedPage)
        val token = bridge.blobs.registerBytes("picked.txt", "text/plain", "private".toByteArray())

        webView.loadUrl("https://evil.example.com/portal")
        webView.webViewClient.onPageStarted(webView, "https://evil.example.com/portal", null)
        assertFalse("a real redirect to a foreign page must revoke the bridge", bridge.trustedPage)
        assertTrue("navigating away must revoke pending file URLs", bridge.blobs.lookup(token) == null)
    }

    @Test
    fun `query strings mentioning the chat host are not the chat site`() {
        webView.loadUrl(lookAlike)
        webView.webViewClient.onPageStarted(webView, lookAlike, null)
        assertFalse("host, not substring, decides trust", bridge.trustedPage)
    }

    @Test
    fun `fragment jumps on the chat page stay trusted`() {
        webView.loadUrl(chatPage)
        webView.webViewClient.onPageStarted(webView, chatPage, null)
        webView.webViewClient.onPageStarted(webView, "$chatPage#msg-42", null)
        assertTrue("an in-page anchor is still the same main frame", bridge.trustedPage)
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private fun findWebView(activity: MainActivity): WebView {
        val content = activity.window.decorView
            .findViewById<android.view.ViewGroup>(android.R.id.content)
        val rootLayout = content.getChildAt(0) as FrameLayout
        return rootLayout.getChildAt(0) as WebView
    }

    private fun bridgeOf(activity: MainActivity): WebViewBridge {
        val field = MainActivity::class.java.getDeclaredField("bridge")
        field.isAccessible = true
        return field.get(activity) as WebViewBridge
    }
}
