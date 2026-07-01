package com.outreach.notification.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String type,
        String title,
        String body,
        String ctaUrl,
        boolean isRead,
        String[] channels,
        String deliveryStatus,
        OffsetDateTime createdAt
) {}
