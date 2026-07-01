package com.outreach.tracker.inbound.dto;

import java.time.LocalDate;

/**
 * Optional user overrides when confirming a draft.
 * Any null field means "keep the parsed value".
 */
public record ConfirmDraftRequest(
        String company,
        String role,
        LocalDate appliedDate
) {}
