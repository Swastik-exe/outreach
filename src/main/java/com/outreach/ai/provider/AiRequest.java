package com.outreach.ai.provider;

/**
 * Input to every AI provider.  resumeText is already sanitized; targetRole may be null.
 */
public record AiRequest(
        String resumeText,
        String targetRole,
        String taskType      // e.g. "resume_analysis"
) {}
