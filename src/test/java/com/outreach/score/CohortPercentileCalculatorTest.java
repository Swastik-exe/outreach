package com.outreach.score;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CohortPercentileCalculatorTest {

    @Test
    void histogramBucketsCoverAllScores() {
        Map<String, Integer> hist = CohortPercentileCalculator.buildHistogram(
                List.of(50, 150, 250, 550, 950));
        assertEquals(5, hist.values().stream().mapToInt(Integer::intValue).sum());
        assertTrue(hist.containsKey("0-100"));
        assertTrue(hist.containsKey("901-1000"));
    }

    @Test
    void percentileHigherScoreRanksBetter() {
        Map<String, Integer> hist = new LinkedHashMap<>();
        hist.put("0-100", 5);
        hist.put("101-200", 5);
        hist.put("201-300", 5);
        hist.put("301-400", 5);
        int low = CohortPercentileCalculator.percentile(150, hist, 20);
        int high = CohortPercentileCalculator.percentile(350, hist, 20);
        assertTrue(high > low);
    }

    @Test
    void topBandFromPercentileRank() {
        assertEquals("Top 30%", CohortPercentileCalculator.toTopBand(70));
        assertEquals("Top 10%", CohortPercentileCalculator.toTopBand(92));
    }

    @Test
    void percentileAtMedian() {
        List<Integer> scores = List.of(100, 200, 300, 400, 500);
        assertEquals(300, CohortPercentileCalculator.percentileAt(scores, 0.50));
    }
}
