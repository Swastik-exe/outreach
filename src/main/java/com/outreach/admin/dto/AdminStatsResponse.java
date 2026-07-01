package com.outreach.admin.dto;

import lombok.Builder;

import java.math.BigDecimal;

@Builder
public record AdminStatsResponse(
        BigDecimal aiCostToday,
        long activeUsersToday,
        long revenueThisMonthInr,
        long failedJobs,
        String systemStatus
) {}
