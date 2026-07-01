package com.outreach.feedback.dto;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record FeedbackResponse(
        UUID id,
        String message,
        String screen,
        String type,
        OffsetDateTime createdAt
) {}
