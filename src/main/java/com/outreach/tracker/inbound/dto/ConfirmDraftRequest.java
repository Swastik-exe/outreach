package com.outreach.tracker.inbound.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Optional user overrides when confirming a draft.
 * Any null field means "keep the parsed value".
 */
public record ConfirmDraftRequest(
        @Size(max = 200) String company,
        @Size(max = 200) String role,
        LocalDate appliedDate
) {}
