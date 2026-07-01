package com.outreach.tracker.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ApplicationResponse(
        UUID id,
        String company,
        String companyCanonical,
        String role,
        String roleCanonical,
        String source,
        String sourcePlatform,
        String jobUrl,
        LocalDate appliedDate,
        UUID resumeId,
        String currentStatus,
        String priority,
        String recruiterName,
        String recruiterEmail,
        String nextAction,
        OffsetDateTime nextActionDue,
        Integer responseLatencyDays,
        String notes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        /** Populated only on GET /applications/{id} and GET /applications/{id}/timeline. */
        List<TimelineEntryResponse> timeline
) {}
