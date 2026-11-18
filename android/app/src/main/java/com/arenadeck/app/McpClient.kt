package com.arenadeck.app

import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSource
import org.json.JSONArray
import org.json.JSONObject

/** Streamable HTTP tool client. Configuration lives in the original engine store; sessions and
 * catalogs are disposable. Never take credentials or tool permissions from a chat message. */
internal class McpClient(client: OkHttpClient, private val settings: () -> String?,
                         private val networkPolicy: (String) -> String?) {
    private val http = client.newBuilder().followRedirects(false).followSslRedirects(false)
        .retryOnConnectionFailure(false).callTimeout(30, TimeUnit.SECONDS).build()
    private val ids = AtomicLong(0)
    private class Connection(val configId: String, val url: String, val key: String) {
        var sid: String? = null
        var version: String? = null
        var auth = "Bearer"
        var names: Set<String>? = null
    }
    private val sessions = ConcurrentHashMap<String, Connection>()
    private val gate = Any()
    private class Problem(val kind: String, message: String, val status: Int? = null) : Exception(message)
    private fun fail(kind: String, msg: String): Nothing = throw Problem(kind, msg)
    private fun selected(url: String): JSONObject? {
        val rows = runCatching { JSONArray(settings() ?: "[]") }.getOrNull() ?: return null
        return (0 until rows.length()).mapNotNull { rows.optJSONObject(it) }
            .singleOrNull { it.optString("serverUrl").trim() == url && it.optBoolean("enabled", true) && it.optString("id").isNotBlank() }
    }
    private fun matches(c: Connection, row: JSONObject?) = row != null &&
        row.optString("id") == c.configId && row.optString("apiKey").trim() == c.key

    /** Called after a real settings write; dropping the last reference invalidates queued calls too. */
    fun reconcile() = synchronized(gate) {
        sessions.values.toList().forEach { if (!matches(it, selected(it.url))) sessions.remove(it.url, it) }
    }
    private fun check(c: Connection) {
        if (sessions[c.url] !== c || !matches(c, selected(c.url))) fail("disconnected", "MCP server disconnected or changed.")
    }
    private fun connection(url: String): Connection = synchronized(gate) {
        val row = selected(url) ?: fail("disconnected", "Blocked: configure and enable this MCP server first.")
        val target = url.toHttpUrlOrNull() ?: fail("url", "Invalid MCP endpoint.")
        if (target.username.isNotEmpty() || target.password.isNotEmpty() || target.fragment != null)
            fail("url", "Use an HTTP(S) endpoint without embedded credentials or a fragment.")
        val key = row.optString("apiKey").trim()
        if (key.isNotEmpty() && !target.isHttps) fail("url", "Use HTTPS for an MCP API key.")
        sessions[url]?.takeIf { matches(it, row) } ?: Connection(row.getString("id"), url, key).also { sessions[url] = it }
    }
    fun request(payload: JSONObject, listing: Boolean): JSONObject = try {
        val c = connection(payload.optString("serverUrl").trim())
        synchronized(c) {
            check(c)
            // A list is read-only and may safely reconnect once. Never replay a tools/call:
            // an HTTP error or a broken stream cannot prove that a side effect did not happen.
            if (listing) {
                val tools = try { discover(c) } catch (e: Problem) {
                    if (e.kind != "expired") throw e
                    discover(c)
                }
                JSONObject().put("ok", true).put("tools", tools)
            } else {
                val tool = payload.optString("toolName")
                val args = payload.optJSONObject("args") ?: fail("arguments", "Tool arguments must be a JSON object.")
                if (c.names == null) discover(c)
                if (tool !in c.names.orEmpty()) fail("not_listed", "The connected server does not advertise that tool.")
                val result = rpc(c, "tools/call", JSONObject().put("name", tool).put("arguments", args))
                if (result.optBoolean("isError")) fail("tool_error", "The MCP tool reported an execution error. Check the arguments before retrying.")
                if (!result.has("content") && !result.has("structuredContent")) fail("protocol", "MCP returned no tool result.")
                check(c)
                JSONObject().put("ok", true).put("result", result)
            }
        }
    } catch (e: Problem) {
        JSONObject().put("ok", false).put("code", e.kind).put("error", e.message).also { if (e.status != null) it.put("status", e.status) }
    } catch (_: IOException) {
        JSONObject().put("ok", false).put("code", "network").put("error", "MCP connection interrupted or timed out. Execution was not retried.")
    } catch (_: Exception) {
        JSONObject().put("ok", false).put("code", "protocol").put("error", "Invalid MCP response or configuration.")
    }
    private fun discover(c: Connection): JSONArray {
        c.names = null
        if (c.version == null) {
            val init = JSONObject().put("protocolVersion", VERSIONS.first()).put("capabilities", JSONObject())
                .put("clientInfo", JSONObject().put("name", "ArenaPilot").put("version", BuildConfig.VERSION_NAME))
            c.auth = "Bearer"
            val hello = try { rpc(c, "initialize", init) } catch (e: Problem) {
                if (e.status !in listOf(401, 403) || c.key.isEmpty()) throw e
                c.auth = "X-API-Key"; rpc(c, "initialize", init)
            }
            val v = hello.optString("protocolVersion")
            if (v !in VERSIONS || hello.optJSONObject("capabilities")?.optJSONObject("tools") == null)
                fail("incompatible", "Server did not negotiate a supported MCP tools protocol.")
            c.version = v
            try { rpc(c, "notifications/initialized", null) } catch (e: Exception) { c.version = null; c.sid = null; throw e }
        }
        val result = JSONArray(); val names = mutableSetOf<String>(); val cursors = mutableSetOf<String>(); var cursor = ""; var total = 0L
        repeat(32) {
            val data = rpc(c, "tools/list", JSONObject().also { if (cursor.isNotEmpty()) it.put("cursor", cursor) })
            val tools = data.optJSONArray("tools") ?: fail("protocol", "MCP returned an invalid tool list.")
            for (i in 0 until tools.length()) {
                val tool = tools.getJSONObject(i); val name = tool.getString("name")
                if (name.isBlank() || name.length > 128 || !names.add(name) || tool.optJSONObject("inputSchema") == null)
                    fail("protocol", "Invalid or duplicate MCP tool schema.")
                total += tool.toString().toByteArray().size
                if (names.size > 512 || total > MAX_BYTES) fail("limit", "MCP catalog exceeds the app limit.")
                result.put(tool)
            }
            cursor = if (data.isNull("nextCursor")) "" else data.getString("nextCursor")
            if (cursor.isEmpty()) { check(c); c.names = names; return result }
            if (!cursors.add(cursor)) fail("protocol", "MCP server repeated its discovery cursor.")
        }
        fail("limit", "Too many MCP catalog pages.")
    }
    private fun rpc(c: Connection, method: String, params: JSONObject?): JSONObject {
        check(c)
        if (networkPolicy(c.url) != null) fail("blocked", "Blocked: private and local MCP endpoints are not allowed.")
        val id = if (params != null) ids.incrementAndGet() else null
        val body = JSONObject().put("jsonrpc", "2.0").put("method", method)
        if (id != null) body.put("id", id).put("params", params)
        val b = Request.Builder().url(c.url).header("Accept", "application/json, text/event-stream")
        if (method != "initialize") {
            c.sid?.let { b.header("Mcp-Session-Id", it) }; c.version?.let { b.header("MCP-Protocol-Version", it) }
        }
        if (c.key.isNotEmpty()) {
            if (c.auth == "Bearer") b.header("Authorization", "Bearer ${c.key}") else b.header("X-API-Key", c.key)
        }
        http.newCall(b.post(body.toString().toRequestBody("application/json".toMediaType())).build()).execute().use { res ->
            if (res.code == 404 && c.sid != null && method != "initialize") {
                c.sid = null; c.version = null; c.names = null
                throw Problem("expired", "MCP session expired. Refresh the connection before trying again.", 404)
            }
            if (!res.isSuccessful) throw Problem(if (res.code in listOf(401, 403)) "authentication" else "http", "MCP server returned HTTP ${res.code}.", res.code)
            if (id == null) return JSONObject()
            val response = res.body ?: fail("protocol", "Empty MCP reply.")
            val result = if (response.contentType()?.subtype == "event-stream") readEvents(response.source(), id) else {
                val read = response.byteStream().use { readBoundedBytes(it, MAX_BYTES) }
                if (read.overflowed) fail("limit", "MCP response exceeds the app limit.")
                resultFor(JSONObject(read.bytes.toString(Charsets.UTF_8)), id) ?: fail("protocol", "MCP reply did not match the request.")
            }
            if (method == "initialize") c.sid = res.header("Mcp-Session-Id")?.takeIf { it.isNotBlank() }
            return result
        }
    }
    private fun resultFor(message: JSONObject, id: Long): JSONObject? {
        if (message.optString("jsonrpc") != "2.0" || message.has("method") || (message.opt("id") as? Number)?.toString() != id.toString()) return null
        if (message.has("error")) fail("rpc_error", "MCP server reported a JSON-RPC error.")
        return message.optJSONObject("result") ?: fail("protocol", "MCP reply has no result object.")
    }
    private fun readEvents(source: BufferedSource, id: Long): JSONObject {
        var remaining = MAX_BYTES; val data = StringBuilder()
        fun event(): JSONObject? {
            val text = data.toString().trim(); data.setLength(0)
            return if (text.isEmpty() || text == "[DONE]") null else resultFor(JSONObject(text), id)
        }
        while (!source.exhausted()) {
            val nl = source.indexOf(10.toByte(), 0, remaining + 1)
            val size = if (nl < 0) source.buffer.size else nl
            if (size > remaining || (nl >= 0 && size == remaining)) fail("limit", "MCP event stream exceeds the app limit.")
            val line = source.readUtf8(size).removeSuffix("\r"); remaining -= size
            if (nl >= 0) { source.skip(1); remaining-- }
            if (line.isEmpty()) { event()?.let { return it } }
            else if (line.startsWith("data:")) data.append(line.substring(5).removePrefix(" ")).append('\n')
        }
        return event() ?: fail("protocol", "MCP stream ended without the requested result.")
    }
    companion object {
        const val STORE = "bds_mcp_servers"
        private const val MAX_BYTES = 4L * 1024 * 1024
        private val VERSIONS = listOf("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05")
    }
}
