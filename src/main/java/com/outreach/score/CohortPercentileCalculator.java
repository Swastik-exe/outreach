package com.outreach.score;

import java.util.*;

/**
 * Pure percentile + histogram math for cohort insights (D2).
 */
public final class CohortPercentileCalculator {

    private static final int[] BUCKET_BOUNDS = {
            100, 200, 300, 400, 500, 600, 700, 800, 900, 1000
    };

    private CohortPercentileCalculator() {}

    public static String bucketLabel(int score) {
        int clamped = Math.max(0, Math.min(1000, score));
        for (int bound : BUCKET_BOUNDS) {
            if (clamped <= bound) {
                int low = bound == 100 ? 0 : bound - 99;
                return low + "-" + bound;
            }
        }
        return "901-1000";
    }

    public static Map<String, Integer> buildHistogram(Collection<Integer> scores) {
        Map<String, Integer> hist = new LinkedHashMap<>();
        for (int bound : BUCKET_BOUNDS) {
            int low = bound == 100 ? 0 : bound - 99;
            hist.put(low + "-" + bound, 0);
        }
        for (int s : scores) {
            String key = bucketLabel(s);
            hist.merge(key, 1, Integer::sum);
        }
        return hist;
    }

    public static int percentile(int userScore, Map<String, Integer> histogram, int cohortSize) {
        if (cohortSize <= 0) return 0;
        int below = 0;
        for (var e : histogram.entrySet()) {
            int bucketHigh = parseBucketHigh(e.getKey());
            if (bucketHigh < userScore) {
                below += e.getValue();
            } else if (userScore >= parseBucketLow(e.getKey()) && userScore <= bucketHigh) {
                // linear within bucket
                below += e.getValue() / 2;
            }
        }
        return (int) Math.round(100.0 * below / cohortSize);
    }

    /** "Top 30%" from percentile rank (fraction of cohort the user beats). */
    public static String toTopBand(int percentileRank) {
        int topPct = Math.max(1, Math.min(100, 100 - percentileRank));
        // Round to nearest 5 for cleaner copy
        topPct = ((topPct + 4) / 5) * 5;
        topPct = Math.max(5, Math.min(100, topPct));
        return "Top " + topPct + "%";
    }

    public static int percentileAt(List<Integer> sorted, double p) {
        if (sorted.isEmpty()) return 0;
        List<Integer> copy = new ArrayList<>(sorted);
        Collections.sort(copy);
        int idx = (int) Math.ceil(p * copy.size()) - 1;
        idx = Math.max(0, Math.min(copy.size() - 1, idx));
        return copy.get(idx);
    }

    private static int parseBucketLow(String key) {
        return Integer.parseInt(key.split("-")[0]);
    }

    private static int parseBucketHigh(String key) {
        return Integer.parseInt(key.split("-")[1]);
    }
}
