package com.arenadeck.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The launch screen is released by [MainActivity.READY_PROBE_JS]. It is a rather
 * important eighty lines of JavaScript: if it is too strict the app shows a
 * splash for its full 18 s cap on a perfectly good page, and if it is too loose
 * the raw official site is revealed before the engine has decorated it.
 *
 * These assertions pin the contract — no JVM can run the script, so the shape is
 * what is checked (the emulator job in CI runs the behaviour).
 */
class LaunchReadinessTest {

    private val probe = MainActivity.READY_PROBE_JS
    private fun code() = probe.replace(Regex("(?s)/\\*.*?\\*/"), "")

    @Test
    fun `the page must be loaded, decorated and wired before it counts as ready`() {
        val src = code()
        assertTrue("document must be complete", src.contains("document.readyState!=='complete'"))
        assertTrue("the engine CSS must be in place", src.contains("getElementById('bds-css')"))
        assertTrue("the engine's back handler must be installed", src.contains("__sdHandleBack"))
    }

    @Test
    fun `a composer that exists is enough - it must not have to be on screen`() {
        // A phone shows the Direct Chat composer below the fold often enough
        // (model banner, sample prompts). Requiring a positive height/width was
        // the reason the ready signal never arrived and the launch screen always
        // ran to its cap.
        val src = code()
        assertFalse(
            "the probe must not require the composer to be inside the viewport",
            src.contains("getBoundingClientRect"),
        )
        assertFalse("nor a measured height", src.contains("r.height"))
        assertTrue("but it must exist in the layout", src.contains("getClientRects"))
    }

    @Test
    fun `a disabled or hidden composer is still not ready`() {
        val src = code()
        assertTrue("disabled inputs are skipped", src.contains("el.disabled"))
        assertTrue("aria-disabled inputs are skipped", src.contains("aria-disabled"))
        assertTrue("hidden inputs are skipped", src.contains("visibility==='hidden'"))
        assertTrue("display:none inputs are skipped", src.contains("display==='none'"))
    }

    @Test
    fun `the engine's own inputs are never mistaken for the page's composer`() {
        assertTrue(code().contains("indexOf('bds-')===0"))
    }

    @Test
    fun `the probe is a self-contained expression that always answers`() {
        // evaluateJavascript needs a value, and a thrown error inside the probe
        // used to look exactly like "not ready yet".
        assertTrue(probe.trimStart().startsWith("(function(){try{"))
        assertTrue(probe.trimEnd().endsWith("})()"))
        assertTrue("it answers 0 on any exception", code().contains("catch(e){return '0';}"))
        assertTrue("boolean answers are 0/1", code().contains("return '1';") && code().contains("return '0';"))
    }
}
