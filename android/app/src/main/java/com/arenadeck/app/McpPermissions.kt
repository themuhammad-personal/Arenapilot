package com.arenadeck.app

import java.security.MessageDigest
import java.util.UUID
import org.json.JSONObject

/** An affirmative tap grants one exact call, not an endpoint-wide or permanent permission. */
internal class McpPermissions(private val now: () -> Long = { System.nanoTime() / 1_000_000 }) {
    private var generation = 0L
    private data class Grant(val digest: ByteArray, val expires: Long)
    private val grants = LinkedHashMap<String, Grant>()
    private fun digest(p: JSONObject): ByteArray {
        val fields = org.json.JSONArray().put(p.getString("serverUrl")).put(p.getString("toolName")).put(p.getJSONObject("args"))
        return MessageDigest.getInstance("SHA-256").digest(fields.toString().toByteArray(Charsets.UTF_8))
    }
    @Synchronized fun epoch() = generation
    @Synchronized fun revoke() { generation++; grants.clear() }
    @Synchronized fun grant(p: JSONObject, expected: Long): String? {
        grants.entries.removeAll { it.value.expires <= now() }
        if (expected != generation || grants.size >= 16) return null
        return UUID.randomUUID().toString().also { grants[it] = Grant(digest(p), now() + 15_000) }
    }
    @Synchronized fun consume(p: JSONObject): Boolean {
        val ticket = grants.remove(p.optString("approval")) ?: return false
        return ticket.expires > now() && runCatching { MessageDigest.isEqual(ticket.digest, digest(p)) }.getOrDefault(false)
    }
}
