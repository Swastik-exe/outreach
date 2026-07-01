package com.outreach.tracker;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Produces a canonical (normalised) form of company/role strings for dedup.
 * Rules: lowercase → trim → collapse whitespace → strip legal/location suffixes.
 */
public final class Canonicalizer {

    private Canonicalizer() {}

    /**
     * Order matters: strip "Pvt Ltd" before "Pvt" and "Ltd" individually.
     * All patterns are word-boundary anchored so "India Gate" stays "india gate".
     */
    private static final Pattern SUFFIX_PATTERN = Pattern.compile(
            "\\b("
            + "pvt\\.?\\s+ltd\\.?"          // Pvt Ltd / Pvt. Ltd.
            + "|pvt\\.?"                     // Pvt / Pvt.
            + "|llc\\.?"                     // LLC
            + "|ltd\\.?"                     // Ltd
            + "|l\\.l\\.c\\.?"               // L.L.C.
            + "|inc\\.?"                     // Inc
            + "|incorporated"
            + "|corp\\.?"                    // Corp
            + "|corporation"
            + "|limited"
            + "|llp\\.?"                     // LLP
            + "|gmbh"
            + "|sdn\\.?\\s*bhd\\.?"          // Sdn Bhd
            + "|technologies"
            + "|technology"
            + "|solutions"
            + "|services"
            + "|systems"
            + "|india"
            + "|global"
            + "|group"
            + ")"
            + "\\b\\.?",
            Pattern.CASE_INSENSITIVE
    );

    /** Normalise a company or role name for dedup comparison. */
    public static String canonicalize(String raw) {
        if (raw == null || raw.isBlank()) return "";

        String s = raw.toLowerCase(Locale.ROOT).trim();
        // Collapse internal whitespace first so suffix regex is deterministic
        s = s.replaceAll("\\s+", " ");
        // Strip legal / location suffixes (may run twice to catch "Technologies India")
        s = SUFFIX_PATTERN.matcher(s).replaceAll(" ");
        s = SUFFIX_PATTERN.matcher(s).replaceAll(" ");
        // Re-collapse after removal
        s = s.replaceAll("\\s+", " ").trim();
        return s;
    }
}
