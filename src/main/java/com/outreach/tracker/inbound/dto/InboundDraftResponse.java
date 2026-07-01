package com.outreach.tracker.inbound.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record InboundDraftResponse(
        UUID id,
        String parsedCompany,
        String parsedRole,
        LocalDate parsedDate,
        BigDecimal confidence,
        boolean needsReview,     // true if confidence < 0.6
        String status,
        OffsetDateTime createdAt
) {}
