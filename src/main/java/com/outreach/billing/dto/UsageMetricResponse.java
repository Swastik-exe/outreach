package com.outreach.billing.dto;

import java.time.OffsetDateTime;

public record UsageMetricResponse(
        String metric,
        int used,
        int limit,
        OffsetDateTime resetsAt
) {}
