package com.superdeepseek.app

/**
 * The chat site the app wraps — arena.ai (Direct Chat) for ArenaPilot.
 *
 * The engine bundle (`assets/bds`) carries a second, DeepSeek profile for its
 * own site branches; this is the native twin of `bds/sd-site.js`, which does
 * the same split for the engine's site knowledge (`window.__sdProfile`). Both
 * select by host, so the app can never wrap a site its profile did not declare.
 *
 * Deliberately a plain value object with the active site passed as a parameter
 * (defaulting to [Sites.ACTIVE]): the DeepSeek profile stays unit-testable as
 * a fixture (the engine still contains its branches), while only the arena
 * profile is ever built.
 */
internal data class SiteProfile(
    /** Stable id — also the profile id `sd-site.js` detects. */
    val id: String,

    /** Hosts that ARE the chat page: exact match, never a suffix or `contains`. */
    val hosts: List<String>,

    /** Loaded on a cold start. */
    val baseUrl: String,

    /** "New chat": launcher shortcut, and the post-crash fallback target. */
    val newChatUrl: String,

    /** One open conversation — restored after a renderer crash or process kill. */
    val sessionPath: Regex,

    /** Host suffixes kept inside the app; anything else opens in the browser. */
    val inAppHostSuffixes: List<String>,

    /** The site's composer, in preference order (site-owned DOM). */
    val composerSelectors: List<String>,

    /**
     * Whether the in-app updater runs. It reads THIS repo's GitHub releases,
     * which publish the ArenaPilot APK on the `arena-latest` channel. Off for
     * now: the checker predates that channel (it looked for the Super DeepSeek
     * asset name) and is re-enabled in phase N3 once it is adapted.
     */
    val selfUpdateEnabled: Boolean = true,
) {
    /** Canonical host: what a trusted page URL is rebuilt with. */
    val host: String get() = hosts.first()

    /**
     * True when [candidate] is one of this site's chat hosts. Exact,
     * case-insensitive match on the whole host — `chat.deepseek.com.evil.example`
     * and a trailing dot are the two shapes that must not pass.
     */
    fun isSiteHost(candidate: String?): Boolean {
        val h = candidate?.lowercase()?.trim()?.removeSuffix(".") ?: return false
        if (h.isEmpty()) return false
        return hosts.any { it == h }
    }

    /** True when [candidate] is this site or one of its own subdomains. */
    fun isInAppHost(candidate: String?): Boolean {
        val h = candidate?.lowercase()?.trim() ?: return false
        if (h.isEmpty()) return false
        return inAppHostSuffixes.any { h == it || h.endsWith(".$it") }
    }
}

internal object Sites {

    /** The shipped app: DeepSeek's official chat. Values are the ones the app always had. */
    val DEEPSEEK = SiteProfile(
        id = "deepseek",
        hosts = listOf("chat.deepseek.com"),
        baseUrl = "https://chat.deepseek.com/",
        newChatUrl = "https://chat.deepseek.com/",
        sessionPath = Regex("^/a/chat/s/[A-Za-z0-9-]{1,80}/?$"),
        inAppHostSuffixes = listOf("deepseek.com"),
        composerSelectors = listOf("textarea#chat-input", ".ds-textarea textarea"),
    )

    /**
     * arena.ai — the free Chatbot Arena site (LMArena, rebranded 2026-01-28).
     *
     * **Direct Chat only** (owner decision): Battle / Side-by-side pages are not
     * wrapped, so they get no engine extras there.
     *
     * Every value below is marked. `VERIFIED` comes from a public source that
     * reads arena.ai's own DOM/API (the `arena-utils` browser extension, a
     * published arena.ai API map). `MODELLED` is inferred and MUST be confirmed
     * against a real capture — see docs/arena/PLAN-BN.md, Phase 0.
     */
    val ARENA = SiteProfile(
        id = "arena",
        // VERIFIED: both the apex and www hosts are used publicly.
        hosts = listOf("arena.ai", "www.arena.ai"),
        baseUrl = "https://arena.ai/",
        // VERIFIED path (`/text/direct?model_a=…` opens a Direct Chat); the
        // model-less form is MODELLED and Phase 0 must confirm it lands on the
        // composer instead of a model picker.
        newChatUrl = "https://arena.ai/text/direct",
        // MODELLED: a Direct Chat lives at `/c/{id}`; the id charset is inferred
        // from the observed ids, not from a published spec.
        sessionPath = Regex("^/c/[A-Za-z0-9_-]{1,80}/?$"),
        inAppHostSuffixes = listOf("arena.ai"),
        // VERIFIED: `textarea[name="message"]` is the Direct Chat composer (a
        // React controlled input — the engine sets it through the native value
        // setter, as it already does on DeepSeek).
        composerSelectors = listOf("textarea[name=\"message\"]", "main textarea"),
        selfUpdateEnabled = false,
    )

    /** The site this app wraps, chosen by BuildConfig.SITE_ID. */
    val ACTIVE: SiteProfile = when (BuildConfig.SITE_ID) {
        "arena" -> ARENA
        else -> DEEPSEEK
    }
}

/** Quote a selector as a JS single-quoted string literal. */
private fun jsString(value: String): String =
    "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"

/**
 * JS expression resolving the site's composer element (or `null`). Shared by
 * [MainActivity]'s "Ask the AI" handoff and [UiPolish]'s command-insert fix so
 * both follow the site profile, and neither hardcodes a site's DOM.
 *
 * [extraFallbacks] are appended as `||document.querySelector(…)` terms — the
 * callers that want a generic last resort keep theirs.
 */
internal fun composerLookupJs(
    site: SiteProfile = Sites.ACTIVE,
    extraFallbacks: List<String> = emptyList(),
): String =
    (site.composerSelectors + extraFallbacks)
        .joinToString("||") { "document.querySelector(${jsString(it)})" }
