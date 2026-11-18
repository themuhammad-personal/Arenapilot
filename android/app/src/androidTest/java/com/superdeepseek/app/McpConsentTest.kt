package com.arenadeck.app

import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Exercise the actual foreground native UI, not a JS confirm stub. No network or account. */
@RunWith(AndroidJUnit4::class)
class McpConsentTest {
    @get:Rule val activity = ActivityScenarioRule(MainActivity::class.java)
    private fun decide(button: Int): Boolean? {
        val result = AtomicReference<Boolean?>()
        activity.scenario.onActivity { a -> buildMcpReviewDialog(a, JSONObject().put("destination", "https://tools.example/mcp")
            .put("tool", "lookup").put("arguments", "{\"city\":\"Dhaka\"}")) { result.set(it) }.show() }
        onView(withId(button)).perform(click())
        return result.get()
    }
    @Test fun cancelAndAllowOnceAreSeparateUserDecisions() {
        assertEquals(false, decide(android.R.id.button2)); assertEquals(true, decide(android.R.id.button1))
    }
}
