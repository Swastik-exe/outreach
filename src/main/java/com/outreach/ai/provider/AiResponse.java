package com.outreach.ai.provider;

import java.util.List;

/**
 * Schema-validated response from any AI provider.
 * Scores are 0-100; fixes are plain strings (top-10 max).
 */
public record AiResponse(
        int readinessScore,
        int keywordScore,
        int impactScore,
        int formattingScore,
        List<String> keywordGaps,
        List<String> fixes,
        String provider,
        String model,
        int inputTokens,
        int outputTokens
) {}
