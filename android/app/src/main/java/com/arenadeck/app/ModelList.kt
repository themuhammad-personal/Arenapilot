package com.arenadeck.app

import org.json.JSONArray
import org.json.JSONObject

/**
 * The model list the site's picker reads, and where it comes from.
 *
 * Why this is native and not a request from the page:
 * ---------------------------------------------------------------------------
 * arena's picker is a small model list served by arena itself. The list has grown
 * well past what that response can carry comfortably, and the only reliable way to
 * keep it current is to serve it ourselves. Two reasons it must live here:
 *
 *  1. **The `/models` endpoints are browser-only.** arena signs them with a
 *     Cloudflare clearance cookie and a captcha token minted by the page. A plain
 *     OkHttp request (what `bds-fetch-url` does) is answered with a 403 challenge,
 *     not JSON. The WebView, however, already has the clearance cookie — because
 *     the rest of the app works — so the fetch has to be issued *from inside the
 *     page*. This file therefore only decides WHAT to serve and HOW to parse it.
 *
 *  2. **The app must not be the only copy.** A list compiled into the APK goes
 *     stale the day a model ships and would need a new release for a text file. So
 *     the data is downloaded from this repository's `models` release tag, cached on
 *     the phone, and used offline when there is no network. The APK ships a copy of
 *     the same file, so the very first launch has something true to show.
 *
 * Wire format (what a page-side reader consumes)
 * ----------------------------------------------
 * The canonical file is `models.json` at the repository root, published as a
 * release asset. It is deliberately plain: one object per model, nothing derived at
 * build time. This object converts it into the two shapes the page needs:
 *
 *   `{ "models": [ { id, name, provider, contextTokens, note }, … ],
 *      "version": 3, "fetchedAt": 1699999999999, "source": "remote" | "cache" | "bundled" }`
 *
 * A malformed or empty file is never served: [parse] returns null, and the caller
 * keeps whatever it had. A picker that silently goes blank is worse than a stale
 * one, which is the failure the owner's screenshot shows.
 */
internal object ModelList {

    /** Release tag that carries the published list. */
    const val RELEASE_TAG = "models"

    /** Asset name inside that release, and the file name in the repository. */
    const val ASSET_NAME = "models.json"

    /** Where the updater asks for it: this repo's release, never a third party. */
    fun downloadUrl(owner: String, repo: String): String =
        "https://github.com/$owner/$repo/releases/download/$RELEASE_TAG/$ASSET_NAME"

    /** How many models a usable list must contain before it is served at all. */
    const val MIN_MODELS = 1

    /**
     * One model, normalised. [id] is what the page sends back; [name] is what the
     * user reads; [provider] is only for the secondary label.
     */
    data class Model(
        val id: String,
        val name: String,
        val provider: String,
        val contextTokens: Long,
        val note: String,
    )

    /**
     * Accepts either a raw array or `{ "models": [...] }`, and drops entries that
     * could not be picked (no id, no name). Returns null when nothing usable is
     * left — an empty list must never replace a working one.
     */
    fun parse(text: String?): List<Model>? {
        val raw = text?.trim().orEmpty()
        if (raw.isEmpty()) return null
        val array = try {
            when (val first = raw.first()) {
                '[' -> JSONArray(raw)
                '{' -> JSONObject(raw).optJSONArray("models")
                else -> null
            }
        } catch (_: Exception) {
            null
        } ?: return null

        val models = ArrayList<Model>(array.length())
        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i) ?: continue
            val id = item.optString("id").trim()
            if (id.isEmpty()) continue
            val name = item.optString("name").trim().ifEmpty { id }
            models.add(
                Model(
                    id = id,
                    name = name,
                    provider = item.optString("provider").trim(),
                    contextTokens = item.optLong("contextTokens", 0L).coerceAtLeast(0L),
                    note = item.optString("note").trim(),
                )
            )
        }
        return models.takeIf { it.size >= MIN_MODELS }
    }

    /**
     * The payload the page receives. `source` says where the bytes came from so the
     * UI can be honest about it ("bundled" means the shipped copy, still valid).
     */
    fun toJson(models: List<Model>, source: String, fetchedAt: Long, version: Int = 1): String {
        val out = JSONObject()
        val array = JSONArray()
        for (m in models) {
            array.put(
                JSONObject()
                    .put("id", m.id)
                    .put("name", m.name)
                    .put("provider", m.provider)
                    .put("contextTokens", m.contextTokens)
                    .put("note", m.note)
            )
        }
        out.put("version", version)
        out.put("fetchedAt", fetchedAt)
        out.put("source", source)
        out.put("count", models.size)
        out.put("models", array)
        return out.toString()
    }

    /**
     * Which of two candidate lists wins.
     *
     * Newer wins, but a *smaller* new list only wins when it is strictly newer —
     * providers retire models, so a shorter list is legitimate, yet a truncated
     * download must not overwrite a complete one. [fetchedAt] is 0 for the bundled
     * copy, which is why the bundle never beats a downloaded list.
     */
    fun shouldReplace(current: List<Model>?, currentAt: Long, incoming: List<Model>?, incomingAt: Long): Boolean {
        if (incoming == null || incoming.isEmpty()) return false
        if (current == null || current.isEmpty()) return true
        if (incomingAt > currentAt) return true
        if (incomingAt < currentAt) return false
        return incoming.size > current.size
    }
}
