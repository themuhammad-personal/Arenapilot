package com.superdeepseek.app

/**
 * Pages that may use `window.AndroidBridge`: the app's chat site (arena.ai),
 * over https. Which site that is comes from [Sites] — see Site.kt.
 */
internal fun isTrustedBridgeUrl(url: String?, site: SiteProfile = Sites.ACTIVE): Boolean {
    if (url.isNullOrBlank()) return false
    val uri = runCatching { java.net.URI(url) }.getOrNull() ?: return false
    return uri.scheme == "https" && site.isSiteHost(uri.host) && uri.rawUserInfo == null
}

/** Which page URLs may be reopened after a renderer crash or process restore. */
internal object ChatUrls {

    /**
     * [url] when it is an open conversation on [site], otherwise null (the app
     * then opens a new chat). Anything else — login pages, other hosts, query
     * strings — is never restored. The returned URL is rebuilt from the site's
     * canonical host, so a `www.` alias cannot smuggle a foreign origin in.
     */
    fun restorable(url: String?, site: SiteProfile = Sites.ACTIVE): String? {
        if (url.isNullOrBlank() || url.length > 200) return null
        val uri = runCatching { java.net.URI(url) }.getOrNull() ?: return null
        if (uri.scheme != "https" || !site.isSiteHost(uri.host) || uri.port != -1) return null
        if (uri.rawQuery != null || uri.rawFragment != null || uri.rawUserInfo != null) return null
        val path = uri.rawPath ?: return null
        return if (site.sessionPath.matches(path)) "https://${site.host}$path" else null
    }
}
