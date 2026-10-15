package com.superdeepseek.app

import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import okhttp3.Dns
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * The SSRF policy the bridge enforces for every model-steerable HTTP call.
 * Pure JVM: host resolution is injected, so nothing touches the real DNS.
 */
class NetworkGuardTest {

    private fun addr(text: String): InetAddress = InetAddress.getByName(text)

    private fun resolver(vararg pairs: Pair<String, Array<InetAddress>>): (String) -> Array<InetAddress> {
        val table = mapOf(*pairs)
        return { host ->
            table[host] ?: throw java.net.UnknownHostException(host)
        }
    }

    // ── address ranges ─────────────────────────────────────────────────

    @Test
    fun `loopback and unspecified are blocked`() {
        assertEquals("loopback", NetworkGuard.blockedAddressReason(addr("127.0.0.1")))
        assertEquals("loopback", NetworkGuard.blockedAddressReason(addr("127.8.9.10")))
        assertEquals("loopback", NetworkGuard.blockedAddressReason(addr("::1")))
        assertEquals("unspecified address", NetworkGuard.blockedAddressReason(addr("0.0.0.0")))
        assertEquals("loopback", NetworkGuard.blockedAddressReason(addr("::ffff:127.0.0.1")))
    }

    @Test
    fun `private ranges are blocked`() {
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("10.0.0.1")))
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("172.16.0.1")))
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("172.31.255.254")))
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("192.168.1.1")))
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("fc00::1")))
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("fd12:3456::1")))
    }

    @Test
    fun `link-local, cgnat and multicast are blocked`() {
        assertEquals("link-local network", NetworkGuard.blockedAddressReason(addr("169.254.169.254")))
        assertEquals("link-local network", NetworkGuard.blockedAddressReason(addr("fe80::1")))
        assertEquals("carrier-grade NAT", NetworkGuard.blockedAddressReason(addr("100.64.0.1")))
        assertEquals("carrier-grade NAT", NetworkGuard.blockedAddressReason(addr("100.127.255.255")))
        assertEquals("multicast", NetworkGuard.blockedAddressReason(addr("224.0.0.1")))
    }

    @Test
    fun `private ranges at the edges are not blocked`() {
        assertNull(NetworkGuard.blockedAddressReason(addr("172.15.255.255")))
        assertNull(NetworkGuard.blockedAddressReason(addr("172.32.0.0")))
        assertNull(NetworkGuard.blockedAddressReason(addr("100.63.255.255")))
        assertNull(NetworkGuard.blockedAddressReason(addr("100.128.0.0")))
        assertNull(NetworkGuard.blockedAddressReason(addr("9.255.255.255")))
        assertNull(NetworkGuard.blockedAddressReason(addr("11.0.0.0")))
    }

    @Test
    fun `public addresses are allowed`() {
        assertNull(NetworkGuard.blockedAddressReason(addr("1.1.1.1")))
        assertNull(NetworkGuard.blockedAddressReason(addr("8.8.8.8")))
        assertNull(NetworkGuard.blockedAddressReason(addr("2606:4700:4700::1111")))
    }

    @Test
    fun `ipv4 embedded in ipv6 is judged as ipv4`() {
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("::ffff:192.168.0.1")))
        assertEquals("loopback", NetworkGuard.blockedAddressReason(addr("::ffff:127.0.0.1")))
        assertEquals("private network", NetworkGuard.blockedAddressReason(addr("::10.0.0.1")))
        assertNull(NetworkGuard.blockedAddressReason(addr("::ffff:8.8.8.8")))
    }

    // ── hosts and URLs ─────────────────────────────────────────────────

    @Test
    fun `localhost names are blocked without a lookup`() {
        assertEquals("loopback", NetworkGuard.blockedHostReason("localhost", resolver()))
        assertEquals("loopback", NetworkGuard.blockedHostReason("LocalHost", resolver()))
        assertEquals("loopback", NetworkGuard.blockedHostReason("app.localhost", resolver()))
    }

    @Test
    fun `literal IPs are blocked without a lookup`() {
        assertEquals("private network", NetworkGuard.blockedHostReason("192.168.0.1", resolver()))
        assertEquals("loopback", NetworkGuard.blockedHostReason("::1", resolver()))
        assertEquals("loopback", NetworkGuard.blockedHostReason("[::1]", resolver()))
    }

    @Test
    fun `a DNS name that resolves to a private address is blocked`() {
        val r = resolver(
            "router.lan" to arrayOf(addr("192.168.1.1")),
            "metadata.internal" to arrayOf(addr("169.254.169.254")),
            "mixed.example" to arrayOf(addr("1.1.1.1"), addr("10.0.0.5")),
        )
        assertEquals("host resolves to private network (192.168.1.1)", NetworkGuard.blockedHostReason("router.lan", r))
        assertNotNull(NetworkGuard.blockedHostReason("metadata.internal", r))
        // Any one private answer is enough to block the name.
        assertNotNull(NetworkGuard.blockedHostReason("mixed.example", r))
    }

    @Test
    fun `a DNS name with only public answers is allowed`() {
        val r = resolver("public.example" to arrayOf(addr("1.1.1.1"), addr("2606:4700:4700::1111")))
        assertNull(NetworkGuard.blockedHostReason("public.example", r))
    }

    @Test
    fun `unresolvable names fail closed`() {
        assertEquals("host cannot be resolved", NetworkGuard.blockedHostReason("nope.example", resolver()))
    }

    @Test
    fun `urls are checked by scheme and host`() {
        val r = resolver(
            "evil.example" to arrayOf(addr("127.0.0.1")),
            "api.github.com" to arrayOf(addr("1.1.1.1")),
        )
        assertEquals("only http and https URLs are allowed", NetworkGuard.blockedUrlReason("file:///etc/passwd"))
        assertEquals("only http and https URLs are allowed", NetworkGuard.blockedUrlReason("ftp://x/"))
        assertEquals("malformed URL", NetworkGuard.blockedUrlReason("http://exa mple.com/"))
        assertNotNull(NetworkGuard.blockedUrlReason("http://evil.example/admin", r))
        assertNull(NetworkGuard.blockedUrlReason("https://api.github.com/repos", r))
        assertNotNull(NetworkGuard.blockedUrlReason("http://169.254.169.254/latest/meta-data/", r))
    }

    // ── DNS rebinding defence ──────────────────────────────────────────

    @Test
    fun `FilteringDns refuses private answers at request time`() {
        val evil = FilteringDnsTestDelegate(mapOf("rebind.example" to listOf(addr("127.0.0.1"))))
        try {
            NetworkGuard.FilteringDns(evil).lookup("rebind.example")
            fail("expected UnknownHostException")
        } catch (e: java.net.UnknownHostException) {
            assertTrue(e.message!!.contains("loopback"))
        }
        // Public names pass through untouched.
        val ok = NetworkGuard.FilteringDns(
            FilteringDnsTestDelegate(mapOf("public.example" to listOf(addr("1.1.1.1"))))
        ).lookup("public.example")
        assertEquals(1, ok.size)
        assertTrue(ok[0] is Inet4Address || ok[0] is Inet6Address)
    }

    private class FilteringDnsTestDelegate(private val table: Map<String, List<InetAddress>>) : Dns {
        override fun lookup(hostname: String): List<InetAddress> =
            table[hostname] ?: throw java.net.UnknownHostException(hostname)
    }
}
