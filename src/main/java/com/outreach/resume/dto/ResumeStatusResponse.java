package com.outreach.resume.dto;

import java.util.UUID;

public record ResumeStatusResponse(
        UUID id,
        String analysisStatus,
        String analysisSource,
        String message
) {}
