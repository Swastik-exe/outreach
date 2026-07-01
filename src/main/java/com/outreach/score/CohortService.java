package com.outreach.score;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.profile.UserProfile;
import com.outreach.profile.UserProfileRepository;
import com.outreach.score.dto.CohortInsightResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CohortService {

    private final UserProfileRepository profileRepository;
    private final CareerHealthScoreRepository scoreRepository;
    private final CohortStatsRepository cohortStatsRepository;
    private final CohortDataRepository cohortDataRepository;
    private final ObjectMapper objectMapper;

    /** Returns the requesting user's cohort band only — never other users' data. */
    @Transactional(readOnly = true)
    public CohortInsightResponse getCohortInsight(UUID userId) {
        UserProfile profile = profileRepository.findByUserId(userId).orElse(null);
        if (profile == null || profile.getCohortKey() == null) {
            return CohortInsightResponse.unavailable();
        }

        String cohortKey = profile.getCohortKey();
        if (!CohortKeyValidator.isValidKey(cohortKey)) {
            return CohortInsightResponse.unavailable();
        }

        CohortStats stats = cohortStatsRepository.findByCohortKey(cohortKey).orElse(null);
        if (stats == null || stats.getCohortSize() == null
                || stats.getCohortSize() < CohortKeyValidator.MIN_COHORT_SIZE) {
            return CohortInsightResponse.unavailable();
        }

        CareerHealthScore score = scoreRepository.findByUserId(userId).orElse(null);
        if (score == null || score.getOverallScore() == null) {
            return CohortInsightResponse.unavailable();
        }

        Map<String, Integer> histogram = parseHistogram(stats.getScoreHistogram());
        if (histogram.isEmpty()) {
            return CohortInsightResponse.unavailable();
        }

        int percentile = CohortPercentileCalculator.percentile(
                score.getOverallScore(), histogram, stats.getCohortSize());
        String band = CohortPercentileCalculator.toTopBand(percentile);

        return CohortInsightResponse.of(band, stats.getCohortSize(), percentile, cohortKey);
    }

    /** Recomputes cohort_stats for every valid cohort_key (called by nightly job). */
    @Transactional
    public int recomputeAllCohorts() {
        List<Object[]> rows = cohortDataRepository.findAllCohortScores();
        Map<String, List<Integer>> byCohort = new HashMap<>();
        for (Object[] row : rows) {
            String key = (String) row[0];
            Number scoreNum = (Number) row[1];
            if (!CohortKeyValidator.isValidKey(key) || scoreNum == null) continue;
            byCohort.computeIfAbsent(key, k -> new ArrayList<>()).add(scoreNum.intValue());
        }

        int updated = 0;
        OffsetDateTime now = OffsetDateTime.now();
        for (var entry : byCohort.entrySet()) {
            String cohortKey = entry.getKey();
            List<Integer> scores = entry.getValue();
            Collections.sort(scores);

            Map<String, Integer> histogram = CohortPercentileCalculator.buildHistogram(scores);

            CohortStats stats = cohortStatsRepository.findByCohortKey(cohortKey)
                    .orElse(CohortStats.builder().cohortKey(cohortKey).build());

            stats.setCohortSize(scores.size());
            stats.setP25(CohortPercentileCalculator.percentileAt(scores, 0.25));
            stats.setP50(CohortPercentileCalculator.percentileAt(scores, 0.50));
            stats.setP75(CohortPercentileCalculator.percentileAt(scores, 0.75));
            stats.setP90(CohortPercentileCalculator.percentileAt(scores, 0.90));
            try {
                stats.setScoreHistogram(objectMapper.writeValueAsString(histogram));
            } catch (Exception e) {
                log.warn("Failed to serialize histogram for cohort {}", cohortKey, e);
                continue;
            }
            stats.setComputedAt(now);
            cohortStatsRepository.save(stats);
            updated++;
        }

        log.info("[CohortStatsJob] Updated {} cohorts", updated);
        return updated;
    }

    private Map<String, Integer> parseHistogram(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse score_histogram JSON", e);
            return Map.of();
        }
    }
}
