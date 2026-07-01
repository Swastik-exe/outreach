package com.outreach.ai.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates and parses the JSON blob returned by an AI provider.
 * Throws {@link SchemaValidationException} (CB-ignored) on any schema mismatch.
 */
public final class ResponseSchemaValidator {

    private ResponseSchemaValidator() {}

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Required numeric fields with inclusive valid range [0, 100]. */
    private static final String[] SCORE_FIELDS = {
            "readiness_score", "keyword_score", "impact_score", "formatting_score"
    };

    public static AiResponse parse(String json, String provider, String model,
                                   int inputTokens, int outputTokens)
            throws SchemaValidationException {
        if (json == null || json.isBlank()) {
            throw new SchemaValidationException("Empty response from provider");
        }
        JsonNode root;
        try {
            root = MAPPER.readTree(stripMarkdownFence(json));
        } catch (Exception e) {
            throw new SchemaValidationException("Non-JSON response: " + e.getMessage());
        }

        for (String field : SCORE_FIELDS) {
            if (!root.has(field) || !root.get(field).isNumber()) {
                throw new SchemaValidationException("Missing or non-numeric field: " + field);
            }
            int val = root.get(field).asInt();
            if (val < 0 || val > 100) {
                throw new SchemaValidationException(field + " out of range [0,100]: " + val);
            }
        }

        List<String> gaps = new ArrayList<>();
        if (root.has("keyword_gaps") && root.get("keyword_gaps").isArray()) {
            root.get("keyword_gaps").forEach(n -> gaps.add(n.asText()));
        }

        List<String> fixes = new ArrayList<>();
        if (root.has("ai_fixes")) {
            JsonNode fixesNode = root.get("ai_fixes");
            if (fixesNode.isArray()) {
                fixesNode.forEach(n -> {
                    if (n.isTextual()) fixes.add(n.asText());
                    else if (n.isObject() && n.has("fix")) fixes.add(n.get("fix").asText());
                });
            }
        }
        // cap at 10
        List<String> cappedFixes = fixes.stream().limit(10).toList();
        List<String> cappedGaps = gaps.stream().limit(10).toList();

        return new AiResponse(
                root.get("readiness_score").asInt(),
                root.get("keyword_score").asInt(),
                root.get("impact_score").asInt(),
                root.get("formatting_score").asInt(),
                cappedGaps,
                cappedFixes,
                provider,
                model,
                inputTokens,
                outputTokens
        );
    }

    /**
     * Some models (notably Gemini) ignore "no markdown" instructions and wrap
     * their JSON in a ```json ... ``` fence. Strip that before parsing.
     */
    private static String stripMarkdownFence(String text) {
        String trimmed = text.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline != -1) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            int lastFence = trimmed.lastIndexOf("```");
            if (lastFence != -1) {
                trimmed = trimmed.substring(0, lastFence);
            }
            trimmed = trimmed.strip();
        }
        return trimmed;
    }
}
