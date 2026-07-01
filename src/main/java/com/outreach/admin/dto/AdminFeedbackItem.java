package com.outreach.admin.dto;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record AdminFeedbackItem(
        UUID id,
        UUID userId,
        String userEmail,
        String message,
        String screen,
        String type,
        OffsetDateTime createdAt
) {}
