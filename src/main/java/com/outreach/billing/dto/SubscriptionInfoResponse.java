package com.outreach.billing.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record SubscriptionInfoResponse(
        String planTier,
        String status,
        boolean seasonPass,
        Integer amountInr,
        OffsetDateTime periodStart,
        OffsetDateTime periodEnd,
        /** True when period_end is in the past (lazy expiry, D13). */
        boolean expired,
        List<UsageMetricResponse> usage
) {}
