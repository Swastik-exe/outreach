package com.outreach.tracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record CreateApplicationRequest(
        @NotBlank String company,
        @NotBlank String role,
        /** manual | forwarded_email — defaults to "manual" if null */
        String source,
        @NotNull LocalDate appliedDate,
        String jobUrl,
        UUID resumeId,
        String notes,
        /** low | medium | high — defaults to "medium" if null */
        String priority
) {}
