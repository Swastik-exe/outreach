package com.outreach.tracker.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** All fields optional — only non-null fields are patched. */
public record UpdateApplicationRequest(
        @Size(max = 200) String company,
        @Size(max = 200) String role,
        LocalDate appliedDate,
        @Size(max = 500) String jobUrl,
        UUID resumeId,
        @Size(max = 5000) String notes,
        @Pattern(regexp = "low|medium|high", message = "priority must be low, medium, or high")
        String priority,
        @Size(max = 200) String recruiterName,
        @Email @Size(max = 320) String recruiterEmail,
        @Size(max = 2000) String nextAction,
        OffsetDateTime nextActionDue
) {}
