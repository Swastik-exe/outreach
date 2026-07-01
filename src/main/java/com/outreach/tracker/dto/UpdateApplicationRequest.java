package com.outreach.tracker.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** All fields optional — only non-null fields are patched. */
public record UpdateApplicationRequest(
        String company,
        String role,
        LocalDate appliedDate,
        String jobUrl,
        UUID resumeId,
        String notes,
        String priority,
        String recruiterName,
        String recruiterEmail,
        String nextAction,
        OffsetDateTime nextActionDue
) {}
