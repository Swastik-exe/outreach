package com.outreach.billing.dto;

import java.util.List;

public record UsageResponse(
        String planTier,
        List<UsageMetricResponse> metrics
) {}
