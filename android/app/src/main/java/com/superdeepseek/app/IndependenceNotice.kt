package com.superdeepseek.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Context

/**
 * ArenaPilot: a one-time notice that this app is an independent project and is
 * not affiliated with, endorsed by or sponsored by arena.ai.
 *
 * It is shown once, right after the launch screen has played, so it never
 * competes with the launch animation or covers a half-loaded page. (It used to
 * live in the `arenaDeck` flavor source set; since the 2026-10-15 flavor
 * cleanup it is part of the single `main` source set, and its strings are
 * `translatable="false"` in `main/res/values/strings.xml`.)
 */
internal object IndependenceNotice {
    private const val PREFS = "sd_notices"
    private const val KEY_SEEN = "independence_notice_privacy_v3_seen"

    /** True while the dialog is up, so two callers can never stack two dialogs. */
    private var showing = false

    fun maybeShow(activity: Activity) {
        if (showing || activity.isFinishing || activity.isDestroyed) return
        val prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_SEEN, false)) return
        showing = true
        // A notice must never be able to take the launch down with it (a stale
        // window token, say): any failure just means it is tried again next launch.
        runCatching {
            AlertDialog.Builder(activity)
                .setTitle(R.string.arena_notice_title)
                .setMessage(R.string.arena_notice_message)
                .setPositiveButton(R.string.arena_notice_ok, null)
                .setCancelable(false)
                // "Seen" is recorded when the user actually dismissed it: a notice that
                // was torn down with its window (process death, activity finish) is
                // simply shown again on the next launch.
                .setOnDismissListener {
                    showing = false
                    prefs.edit().putBoolean(KEY_SEEN, true).apply()
                }
                .show()
        }.onFailure { showing = false }
    }
}
