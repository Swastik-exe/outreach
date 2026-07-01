package com.outreach.score.dto;

/**
 * Cohort percentile insight for the requesting user only — never other users' data.
 */
public record CohortInsightResponse(
        boolean available,
        String band,
        Integer cohortSize,
        /** Percentile rank 0–100 (higher = better vs cohort). */
        Integer percentile,
        String cohortKey
) {
    public static CohortInsightResponse unavailable() {
        return new CohortInsightResponse(false, null, null, null, null);
    }

    public static CohortInsightResponse of(String band, int cohortSize, int percentile, String cohortKey) {
        return new CohortInsightResponse(true, band, cohortSize, percentile, cohortKey);
    }
}
