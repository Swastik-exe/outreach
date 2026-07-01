package com.outreach.ai.provider;

import java.util.regex.Pattern;

/**
 * Strips prompt-injection patterns before text is embedded in an AI prompt.
 * Max chars truncation prevents token runaway.
 */
public final class PromptSanitizer {

    private PromptSanitizer() {}

    private static final int MAX_CHARS = 8_000;

    /** Patterns that indicate prompt injection attempts. */
    private static final Pattern INJECTION = Pattern.compile(
            "(?i)(\\[INST]|</s>|<\\|.*?\\|>|<system>|</system>|SYSTEM\\s*:|"
            + "ignore\\s+previous\\s+instructions?|forget\\s+previous|"
            + "you\\s+are\\s+now|act\\s+as\\s+if|pretend\\s+you\\s+are)",
            Pattern.DOTALL
    );

    public static String sanitize(String text) {
        if (text == null || text.isBlank()) return "";
        String cleaned = INJECTION.matcher(text).replaceAll("[REDACTED]");
        if (cleaned.length() > MAX_CHARS) {
            cleaned = cleaned.substring(0, MAX_CHARS) + "...[truncated]";
        }
        return cleaned;
    }
}
