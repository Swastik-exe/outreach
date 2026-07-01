package com.outreach.tracker.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TimelineEntryResponse(
        UUID id,
        String status,
        String notes,
        OffsetDateTime occurredAt,
        String createdBy
) {}
