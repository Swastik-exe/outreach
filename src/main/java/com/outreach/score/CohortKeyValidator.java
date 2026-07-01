package com.outreach.score;

import com.outreach.profile.TargetRoleTaxonomy;

/**
 * Ensures cohort keys only come from the controlled role taxonomy (D3).
 * Free-text roles must NOT create fragmented cohort keys.
 */
public final class CohortKeyValidator {

    public static final int MIN_COHORT_SIZE = 20;

    private CohortKeyValidator() {}

    /**
     * Builds a canonical cohort key {@code role|year} or returns null if invalid.
     */
    public static String buildKey(String targetRole, Integer graduationYear) {
        if (targetRole == null || graduationYear == null) return null;
        String role = targetRole.trim().toLowerCase();
        if (!TargetRoleTaxonomy.ROLES.contains(role)) return null;
        return role + "|" + graduationYear;
    }

    /** True if the stored key uses a taxonomy role prefix. */
    public static boolean isValidKey(String cohortKey) {
        if (cohortKey == null || cohortKey.isBlank()) return false;
        int sep = cohortKey.indexOf('|');
        if (sep <= 0) return false;
        String role = cohortKey.substring(0, sep);
        String yearPart = cohortKey.substring(sep + 1);
        try {
            Integer.parseInt(yearPart);
        } catch (NumberFormatException e) {
            return false;
        }
        return TargetRoleTaxonomy.ROLES.contains(role);
    }
}
