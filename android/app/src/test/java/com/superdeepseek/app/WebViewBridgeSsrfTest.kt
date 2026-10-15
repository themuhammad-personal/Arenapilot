package com.superdeepseek.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.mockito.kotlin.eq

/**
 * The SSRF policy as it reaches the JS bridge contract: model-steerable
 * fetches to loopback / LAN / router addresses must come back blocked, with
 * no attempt to connect. These use the production default policy (unlike
 * WebViewBridgeTest, which drives a local MockWebServer on purpose).
 */
class WebViewBridgeSsrfTest {

    private lateinit var bridge: WebViewBridge

    @Before
    fun setUp() {
        val prefs = mock(SharedPreferences::class.java)
        val prefsEditor = mock(SharedPreferences.Editor::class.java)
        `when`(prefs.edit()).thenReturn(prefsEditor)
        `when`(prefsEditor.putString(any(), any())).thenReturn(prefsEditor)
        `when`(prefsEditor.putBoolean(any(), any())).thenReturn(prefsEditor)
        `when`(prefsEditor.remove(any())).thenReturn(prefsEditor)

        val context = mock(Context::class.java)
        `when`(context.getSharedPreferences(any(), eq(Context.MODE_PRIVATE))).thenReturn(prefs)
        `when`(context.getString(R.string.bds_asset_authority)).thenReturn("bds-asset.local")

        bridge = WebViewBridge(context)
    }

    private fun fetchUrl(url: String): JSONObject {
        val payload = JSONObject().apply {
            put("type", "bds-fetch-url")
            put("url", url)
            put("options", JSONObject().put("timeoutMs", 1500))
        }
        return JSONObject(bridge.fetch(payload.toString()))
    }

    @Test
    fun `web fetch to a private address is blocked before connecting`() {
        for (url in listOf(
            "http://10.255.255.1/admin",
            "http://192.168.1.1/",
            "http://172.20.5.4/secret",
            "http://169.254.169.254/latest/meta-data/",
            "http://127.0.0.1:8080/",
            "http://[::1]/",
            "http://localhost/admin",
        )) {
            val response = fetchUrl(url)
            assertEquals("$url must be blocked", false, response.optBoolean("ok"))
            assertTrue("$url must be flagged blocked", response.optBoolean("blocked"))
            assertTrue(
                "$url must say why: ${response.optString("error")}",
                response.optString("error").startsWith("Blocked:"),
            )
        }
    }

    @Test
    fun `github zip fetch to a private address is blocked`() {
        val payload = JSONObject().apply {
            put("type", "bds-fetch-github-zip")
            put("url", "http://192.168.0.10/router-config.zip")
        }
        val response = JSONObject(bridge.fetch(payload.toString()))
        assertEquals(false, response.optBoolean("ok"))
        assertTrue(response.optBoolean("blocked"))
    }

    @Test
    fun `MCP calls to a private address are blocked`() {
        val payload = JSONObject().apply {
            put("type", "bds-mcp-call")
            put("serverUrl", "http://127.0.0.1:3000/mcp")
            put("toolName", "run")
            put("args", JSONObject())
        }
        val response = JSONObject(bridge.fetch(payload.toString()))
        assertEquals(false, response.optBoolean("ok"))
        assertTrue(response.optString("error").contains("Blocked:"))
    }

    @Test
    fun `MCP list tools on a private address is blocked`() {
        val payload = JSONObject().apply {
            put("type", "bds-mcp-list-tools")
            put("serverUrl", "http://10.0.0.5/mcp")
        }
        val response = JSONObject(bridge.fetch(payload.toString()))
        assertEquals(false, response.optBoolean("ok"))
        assertTrue(response.optString("error").contains("Blocked:"))
    }

    @Test
    fun `a public address is not blocked by the policy`() {
        // RFC 5737 TEST-NET-1: nothing routes there, so the call fails as a
        // network error — the assertion is that the *policy* let it through.
        val response = fetchUrl("http://192.0.2.1/")
        assertEquals(false, response.optBoolean("ok"))
        assertFalse(response.optBoolean("blocked"))
        assertFalse(response.optString("error").startsWith("Blocked:"))
    }
}
