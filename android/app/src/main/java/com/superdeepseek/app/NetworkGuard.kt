package com.superdeepseek.app

import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URI
import okhttp3.Dns

/**
 * Network guard for every HTTP call the page (and therefore model output) can
 * steer through the bridge: the generic web fetch, the GitHub zip/commit
 * helpers and the MCP client.
 *
 * Prompt-injected model output must never make the app request loopback,
 * LAN or router addresses (SSRF). The Linux sandbox preview keeps its own
 * path — [StudioActivity] opens `http://127.0.0.1:<port>` in the Studio
 * WebView directly and does not go through the bridge fetch — so blocking
 * private targets here breaks nothing the sandbox needs.
 *
 * Blocked: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
 * `169.254.0.0/16`, `0.0.0.0/8`, `100.64.0.0/10` (CGNAT), `::1`,
 * `fc00::/7`, IPv6 link-local, multicast and IPv4-mapped IPv6 forms of any
 * of the above — and any DNS name that resolves to one of them.
 */
internal object NetworkGuard {

    /** Resolves every address of [host]; injectable for tests. */
    internal fun resolveAll(host: String): Array<InetAddress> = InetAddress.getAllByName(host)

    /**
     * Why [addr] must not be fetched from, or null when it is a public address.
     */
    fun blockedAddressReason(addr: InetAddress): String? {
        if (addr.isAnyLocalAddress) return "unspecified address"
        if (addr.isLoopbackAddress) return "loopback"
        if (addr.isLinkLocalAddress) return "link-local network"
        if (addr.isSiteLocalAddress) return "private network"
        if (addr.isMulticastAddress) return "multicast"
        val bytes = addr.address
        when {
            addr is Inet6Address && bytes.size == 16 -> {
                // fc00::/7 — unique local addresses (ULA).
                if (bytes[0].toInt() and 0xFE == 0xFC) return "private network"
                // ::a.b.c.d (deprecated) and ::ffff:a.b.c.d embed IPv4 at offset 12.
                embeddedIpv4(bytes)?.let { return blockedAddressReason(it) }
            }
            addr is Inet4Address && bytes.size == 4 -> {
                val b0 = bytes[0].toInt() and 0xFF
                val b1 = bytes[1].toInt() and 0xFF
                if (b0 == 100 && b1 in 64..127) return "carrier-grade NAT"
            }
        }
        return null
    }

    /** The IPv4 address embedded in a v4-in-v6 address, or null. */
    private fun embeddedIpv4(bytes: ByteArray): Inet4Address? {
        for (i in 0..9) if (bytes[i] != 0.toByte()) return null
        val headIsMapped = bytes[10] == 0xff.toByte() && bytes[11] == 0xff.toByte()
        val headIsTunnel = bytes[10] == 0.toByte() && bytes[11] == 0.toByte()
        if (!headIsMapped && !headIsTunnel) return null
        return runCatching {
            InetAddress.getByAddress(bytes.copyOfRange(12, 16)) as Inet4Address
        }.getOrNull()
    }

    /**
     * Why a URL must not be fetched, or null when it is allowed.
     * Hostnames are resolved, so `http://router.local/` is blocked too.
     */
    fun blockedUrlReason(url: String, resolver: (String) -> Array<InetAddress> = ::resolveAll): String? {
        val uri = runCatching { URI(url.trim()) }.getOrNull() ?: return "malformed URL"
        val scheme = uri.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") return "only http and https URLs are allowed"
        return blockedHostReason(uri.host ?: return "missing host", resolver)
    }

    /**
     * Why a host must not be fetched from, or null when every resolved address
     * is public. Literal IPs are checked without a DNS lookup; names are
     * resolved and every answer is checked (a name that *resolves to*
     * loopback/private is blocked). Unresolvable names fail closed.
     */
    fun blockedHostReason(host: String, resolver: (String) -> Array<InetAddress> = ::resolveAll): String? {
        val h = host.trim().trim('[', ']')
        if (h.isEmpty()) return "missing host"
        if (h.equals("localhost", ignoreCase = true) || h.endsWith(".localhost", ignoreCase = true)) {
            return "loopback"
        }
        literalAddress(h)?.let { return blockedAddressReason(it) }
        val addresses = try {
            resolver(h)
        } catch (_: Exception) {
            return "host cannot be resolved"
        }
        if (addresses.isEmpty()) return "host cannot be resolved"
        for (addr in addresses) {
            blockedAddressReason(addr)?.let { return "host resolves to $it (${addr.hostAddress})" }
        }
        return null
    }

    /** Parses [text] as an IP literal without any DNS lookup, or null. */
    private fun literalAddress(text: String): InetAddress? {
        val v4 = Regex("""^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$""").find(text)
        if (v4 != null) {
            val octets = v4.groupValues.drop(1).map { it.toInt() }
            if (octets.any { it > 255 }) return null
            return runCatching { InetAddress.getByAddress(octets.map { it.toByte() }.toByteArray()) }.getOrNull()
        }
        if (!text.contains(':')) return null
        // A colon form is only ever an IPv6 literal; getByName never resolves it.
        return runCatching { InetAddress.getByName(text) }.getOrNull()
    }

    /**
     * OkHttp DNS filter: even if a name's DNS answer changes between our
     * check and the request (DNS rebinding), no private address is ever
     * connected to.
     */
    internal class FilteringDns(private val delegate: Dns = Dns.SYSTEM) : Dns {
        override fun lookup(hostname: String): List<InetAddress> {
            val addresses = delegate.lookup(hostname)
            for (addr in addresses) {
                blockedAddressReason(addr)?.let {
                    throw java.net.UnknownHostException("$hostname resolves to ${addr.hostAddress} ($it)")
                }
            }
            return addresses
        }
    }
}
