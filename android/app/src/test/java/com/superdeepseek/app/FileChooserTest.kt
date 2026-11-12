package com.superdeepseek.app

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class FileChooserTest {

    @Before
    fun setUp() {
        // Nothing to set up: the accept-list mapping must not depend on which
        // extensions the device (or this JVM) happens to know. See mapAcceptTypes.
    }

    @Test
    fun `buildFileChooserIntent uses GET_CONTENT with openable category and wildcard type`() {
        val intent = buildFileChooserIntent(null, allowMultiple = false)

        assertEquals(Intent.ACTION_GET_CONTENT, intent.action)
        assertTrue(intent.categories?.contains(Intent.CATEGORY_OPENABLE) == true)
        assertEquals("*/*", intent.type)
    }

    @Test
    fun `buildFileChooserIntent sets EXTRA_ALLOW_MULTIPLE when multiple requested`() {
        val multipleIntent = buildFileChooserIntent(null, allowMultiple = true)
        val singleIntent = buildFileChooserIntent(null, allowMultiple = false)

        assertTrue(multipleIntent.getBooleanExtra(Intent.EXTRA_ALLOW_MULTIPLE, false))
        assertFalse(singleIntent.hasExtra(Intent.EXTRA_ALLOW_MULTIPLE))
    }

    @Test
    fun `buildFileChooserIntent filters by MIME-only accept lists`() {
        val intent = buildFileChooserIntent(arrayOf("image/*", "video/mp4"), allowMultiple = false)

        assertArrayEquals(arrayOf("image/*", "video/mp4"), intent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES))
    }

    @Test
    fun `buildFileChooserIntent never greys out files an extension list cannot classify`() {
        // An extension list is filtered only when every token is a format the app
        // can name. A `.py` token cannot be named, and the page wants code files
        // too, so the picker stays open — otherwise document providers (which
        // label code as application/octet-stream) would grey those files out.
        val code = buildFileChooserIntent(arrayOf(".py", ".png"), allowMultiple = false)
        assertNull(code.getStringArrayExtra(Intent.EXTRA_MIME_TYPES))
        assertEquals("*/*", code.type)

        // The same list without the unpickable token is filtered, and being one
        // media family it also narrows the base type.
        val media = buildFileChooserIntent(arrayOf(".png", ".jpg"), allowMultiple = false)
        assertArrayEquals(
                arrayOf("image/png", "image/jpeg"),
                media.getStringArrayExtra(Intent.EXTRA_MIME_TYPES),
        )
        assertEquals("image/*", media.type)
    }

    @Test
    fun `extension tokens are resolved by a table that does not depend on the device`() {
        assertEquals("webp", extensionOfAcceptToken(".webp"))
        assertEquals("webp", extensionOfAcceptToken("WEBP"))
        assertEquals("webp", extensionOfAcceptToken("webp"), "a bare extension is an extension")
        assertNull(extensionOfAcceptToken("image/webp"))
        assertNull(extensionOfAcceptToken("."))
        assertEquals("image/webp", mimeForExtension("webp"))
        assertEquals("image/png", mimeForExtension(".PNG"))
        assertEquals("image/heic", mimeForExtension("heic"), "even where a device table lacks it")
        assertEquals("audio/ogg", mimeForExtension("oga"))
        assertNull(mimeForExtension("py"), "unknown means unknown, not octet-stream")
        assertNull(mimeForExtension(""), "an empty extension is not a type")
    }

    @Test
    fun `an unpickable extension list keeps the picker open`() {
        val intent = buildFileChooserIntent(arrayOf(".weirdext", "text/plain"), allowMultiple = false)

        assertNull(intent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES))
        assertEquals("*/*", intent.type)
    }

    @Test
    fun `a family wildcard survives formats the app cannot name`() {
        // `image/*` covers every image format, including ones added after this
        // build. A newer format's extension must not narrow the picker to the
        // handful of types compiled into the app.
        val intent = buildFileChooserIntent(arrayOf("image/*", ".heic", ".dng"), allowMultiple = false)

        assertArrayEquals(
                arrayOf("image/*"),
                intent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES),
        )
        assertEquals("image/*", intent.type)
    }

    @Test
    fun `buildFileChooserIntent omits the MIME filter for blank or null acceptTypes`() {
        val nullIntent = buildFileChooserIntent(null, allowMultiple = false)
        val blankIntent = buildFileChooserIntent(arrayOf("", "  "), allowMultiple = false)

        assertNull(nullIntent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES))
        assertNull(blankIntent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES))
    }

    @Test
    fun `parseFileChooserResult returns null for cancelled results`() {
        val data = Intent().setData(Uri.parse("content://files/one.txt"))

        assertNull(parseFileChooserResult(Activity.RESULT_CANCELED, data))
    }

    @Test
    fun `parseFileChooserResult reads multiple uris from clipData in order`() {
        val first = Uri.parse("content://files/one.txt")
        val second = Uri.parse("content://files/two.txt")
        val data = Intent().apply {
            clipData =
                    ClipData.newRawUri("files", first).apply {
                        addItem(ClipData.Item(second))
                    }
        }

        assertArrayEquals(arrayOf(first, second), parseFileChooserResult(Activity.RESULT_OK, data))
    }

    @Test
    fun `parseFileChooserResult falls back to intent data for single selections`() {
        val uri = Uri.parse("content://files/one.txt")
        val data = Intent().setData(uri)

        assertArrayEquals(arrayOf(uri), parseFileChooserResult(Activity.RESULT_OK, data))
    }

    @Test
    fun `parseFileChooserResult dedupes duplicate uris`() {
        val uri = Uri.parse("content://files/one.txt")
        val data = Intent().apply {
            clipData =
                    ClipData.newRawUri("files", uri).apply {
                        addItem(ClipData.Item(uri))
                    }
        }

        assertArrayEquals(arrayOf(uri), parseFileChooserResult(Activity.RESULT_OK, data))
    }

    @Test
    fun `parseFileChooserResult returns null when RESULT_OK carries nothing`() {
        assertNull(parseFileChooserResult(Activity.RESULT_OK, Intent()))
    }

    // ── The picker must not offer what the page will refuse ──────────────

    @Test
    fun `the real arena accept list narrows the picker to images`() {
        // The exact list arena's composer hands to the file input, extensions and
        // all, as the emulator capture showed it.
        val intent =
                buildFileChooserIntent(
                        arrayOf("image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp"),
                        allowMultiple = false,
                )

        assertEquals("image/*", intent.type)
        assertArrayEquals(
                arrayOf("image/png", "image/jpeg", "image/webp"),
                intent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES),
        )
    }

    @Test
    fun `an images-only accept list narrows the base type to images`() {
        // A MIME-only image list needs no platform table at all. An unrestricted
        // base type made the system picker offer PDFs and videos, so the user
        // chose a file, the upload failed, and the app had promised something
        // false.
        val intent =
                buildFileChooserIntent(
                        arrayOf("image/png,image/jpeg,image/webp"),
                        allowMultiple = true,
                )

        assertEquals("image/*", intent.type)
        assertArrayEquals(
                arrayOf("image/png", "image/jpeg", "image/webp"),
                intent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES),
        )
    }

    @Test
    fun `a mixed accept list keeps the wide base type`() {
        val intent = buildFileChooserIntent(arrayOf("image/*", "application/pdf"), allowMultiple = false)

        assertEquals("*/*", intent.type)
    }

    @Test
    fun `an unmappable accept list keeps the wide base type`() {
        // An extension-only list cannot be expressed as a MIME base type; the
        // picker must stay open rather than grey out every file.
        val intent = buildFileChooserIntent(arrayOf(".py,.ts,.md"), allowMultiple = false)

        assertEquals("*/*", intent.type)
        assertNull(intent.getStringArrayExtra(Intent.EXTRA_MIME_TYPES))
    }

    @Test
    fun `a wildcard accept list is not narrowed`() {
        assertNull(singleFamilyType(listOf("*/*")))
        assertEquals("image/*", singleFamilyType(listOf("image/png", "image/jpeg")))
        assertEquals("audio/*", singleFamilyType(listOf("audio/mpeg", "audio/ogg")))
        assertNull(singleFamilyType(emptyList()))
    }

    @Test
    fun `a text family is never narrowed (code files are labelled octet-stream)`() {
        // `text/*` as a base type hides the .py/.ts/.md files a code-extension
        // accept list is asking for, because document providers report most of
        // them as application/octet-stream.
        assertNull(singleFamilyType(listOf("text/plain", "text/x-python")))
        assertNull(singleFamilyType(listOf("application/pdf", "application/zip")))
    }
}
