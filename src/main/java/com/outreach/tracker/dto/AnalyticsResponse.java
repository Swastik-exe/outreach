package com.outreach.tracker.dto;

import java.util.Map;

public record AnalyticsResponse(
        int totalApplications,
        /** Percentage of apps that got any response (status != applied). */
        double replyRatePct,
        /** Percentage of apps that reached offer_received or beyond. */
        double conversionRatePct,
        /** Count per app_status value. */
        Map<String, Long> stageCounts,
        /** Most-applied companies (top 5). */
        Map<String, Long> topCompanies
) {}
