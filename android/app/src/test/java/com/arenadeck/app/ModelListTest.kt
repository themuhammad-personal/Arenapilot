package com.arenadeck.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The model list is data the app serves to the site's picker, so a parse bug here
 * is an empty picker in someone's hands. These are the rules that keep it working:
 * a malformed download never replaces a good list, and a list is never served
 * empty.
 */
@RunWith(RobolectricTestRunner::class)
class ModelListTest {

    @Test
    fun `a wrapped list, a bare array and a single object all parse`() {
        val wrapped = ModelList.parse(
            """{"version":1,"models":[{"id":"a","name":"Model A","provider":"P","contextTokens":1000}]}"""
        )
        assertEquals(1, wrapped?.size)
        assertEquals("Model A", wrapped?.get(0)?.name)
        assertEquals(1000L, wrapped?.get(0)?.contextTokens)

        val bare = ModelList.parse("""[{"id":"b","name":"B","provider":"Q"}]""")
        assertEquals("b", bare?.get(0)?.id)

        // A single model is a legitimate file too (a provider with one endpoint).
        val one = ModelList.parse("""{"models":[{"id":"c","name":"C","provider":"R"}]}""")
        assertEquals(1, one?.size)
    }

    @Test
    fun `an entry without an id or a name is dropped, not served`() {
        val list = ModelList.parse(
            """{"models":[
                 {"name":"No id","provider":"P"},
                 {"id":"","name":"Empty id","provider":"P"},
                 {"id":"ok"},
                 {"id":"kept","name":"Kept","provider":"P"}
               ]}"""
        )
        assertEquals(1, list?.size)
        assertEquals("kept", list?.get(0)?.id)
        // A name is what the user taps; without one the id is shown instead of a blank row.
        val noName = ModelList.parse("""[{"id":"only-id","provider":"P"}]""")
        assertEquals("only-id", noName?.get(0)?.name)
    }

    @Test
    fun `a malformed or empty file never replaces what is already there`() {
        assertNull(ModelList.parse(null))
        assertNull(ModelList.parse(""))
        assertNull(ModelList.parse("   "))
        assertNull(ModelList.parse("not json at all"))
        assertNull(ModelList.parse("""{"models":[]}"""), "an empty list is not a list")
        assertNull(ModelList.parse("""{"version":1}"""), "no models key")
        assertNull(ModelList.parse("""{"models":[{"name":"x","provider":"p"}]}"""), "nothing pickable")
    }

    @Test
    fun `the served payload carries where the bytes came from`() {
        val models = listOf(ModelList.Model("m1", "M1", "P", 4096, ""))
        val json = ModelList.toJson(models, source = "cache", fetchedAt = 1_700_000_000_000L)
        assertTrue(json.contains("\"source\":\"cache\""))
        assertTrue(json.contains("\"count\":1"))
        assertTrue(json.contains("\"m1\""))
        assertTrue(json.contains("1700000000000"))
        // and it is what the parser reads back
        assertEquals("m1", ModelList.parse(json)?.get(0)?.id)
    }

    @Test
    fun `the newest list wins, but a truncated one does not`() {
        val small = listOf(ModelList.Model("a", "A", "P", 0, ""))
        val big = listOf(
            ModelList.Model("a", "A", "P", 0, ""),
            ModelList.Model("b", "B", "P", 0, ""),
        )
        // nothing yet → take it
        assertTrue(ModelList.shouldReplace(null, 0, small, 10))
        // strictly newer wins even when shorter: providers retire models
        assertTrue(ModelList.shouldReplace(big, 10, small, 20))
        // older loses
        assertFalse(ModelList.shouldReplace(big, 20, small, 10))
        // same age: a bigger list is the better one (a cut-off download is not newer)
        assertTrue(ModelList.shouldReplace(small, 10, big, 10))
        assertFalse(ModelList.shouldReplace(big, 10, small, 10))
        // an empty incoming list never wins
        assertFalse(ModelList.shouldReplace(big, 10, emptyList(), 99))
        assertFalse(ModelList.shouldReplace(big, 10, null, 99))
        // the bundled copy has fetchedAt 0, so it never beats a download
        assertFalse(ModelList.shouldReplace(big, 1, big, 0))
    }

    @Test
    fun `the download URL is this repository's release, not a third party`() {
        val url = ModelList.downloadUrl("themuhammad-personal", "Arenapilot")
        assertEquals(
            "https://github.com/themuhammad-personal/Arenapilot/releases/download/models/models.json",
            url,
        )
        assertNotNull(ModelList.ASSET_NAME)
    }
}
