package com.outreach.resume.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ResumeResponse(
        UUID id,
        String title,
        Integer version,
        String fileName,
        String targetRole,
        Integer readinessScore,
        Integer keywordScore,
        Integer impactScore,
        Integer formattingScore,
        List<String> keywordGaps,
        String aiFixes,
        String analysisStatus,
        String analysisSource,
        boolean isActive,
        OffsetDateTime createdAt,
        OffsetDateTime analyzedAt
) {}
