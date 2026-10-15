package com.superdeepseek.app

/**
 * Main-frame tracking for WebViewClient callbacks.
 *
 * [android.webkit.WebViewClient.onPageStarted] / [android.webkit.WebViewClient.onPageFinished]
 * can fire for iframe navigations on several WebView versions. Two things must
 * follow the MAIN frame only:
 *
 *  1. Bridge trust ([WebViewBridge.trustedPage]) — a foreign iframe (OAuth,
 *     hCaptcha) on the DeepSeek page must not revoke the bridge, and a
 *     DeepSeek iframe on a foreign page must not grant it.
 *  2. Engine injection — the bundle must never land in a foreign document
 *     (the old check was `url.contains("chat.deepseek.com")`, which a query
 *     string like `https://evil.com/?next=chat.deepseek.com` satisfied).
 *
 * The WebView's own URL is the main frame's URL: a callback whose URL
 * disagrees with it is an iframe navigation.
 */
internal object MainFrameTracker {

    /**
     * True when [callbackUrl] belongs to the main frame. A blank WebView URL
     * (very first load) can only be the main frame. Fragments are ignored —
     * in-page anchors may or may not be reflected by WebView.url.
     */
    fun isMainFrame(callbackUrl: String?, webViewUrl: String?): Boolean {
        if (callbackUrl.isNullOrBlank()) return false
        if (webViewUrl.isNullOrBlank()) return true
        return stripFragment(callbackUrl) == stripFragment(webViewUrl)
    }

    /** The URL that decides bridge trust: the main frame's, never an iframe's. */
    fun mainFrameUrl(callbackUrl: String?, webViewUrl: String?): String? =
        if (isMainFrame(callbackUrl, webViewUrl)) callbackUrl else webViewUrl

    /**
     * New value for [WebViewBridge.trustedPage]. Derived from the main frame's
     * URL even when the callback came from a subframe, so the flag always
     * converges to the page the user is actually looking at.
     */
    fun trustedForPage(
        callbackUrl: String?,
        webViewUrl: String?,
        site: SiteProfile = Sites.ACTIVE,
    ): Boolean = isTrustedBridgeUrl(mainFrameUrl(callbackUrl, webViewUrl), site)

    /** Engine injection: a trusted main frame only — never via `contains`. */
    fun shouldInjectEngine(
        callbackUrl: String?,
        webViewUrl: String?,
        site: SiteProfile = Sites.ACTIVE,
    ): Boolean = isMainFrame(callbackUrl, webViewUrl) && isTrustedBridgeUrl(callbackUrl, site)

    private fun stripFragment(url: String): String = url.substringBefore('#')
}
