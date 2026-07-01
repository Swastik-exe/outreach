package com.outreach.profile;

import java.util.Set;

/**
 * Fixed controlled list for target_role and target_domain.
 * Prevents cohort_key fragmentation (D3): cohorts become sub-20 when roles are free-text.
 * Must be kept in sync with the frontend dropdown values.
 */
public final class TargetRoleTaxonomy {

    private TargetRoleTaxonomy() {}

    public static final Set<String> ROLES = Set.of(
            "software_engineer", "frontend_engineer", "backend_engineer",
            "full_stack_engineer", "data_scientist", "data_analyst",
            "machine_learning_engineer", "devops_engineer", "cloud_engineer",
            "mobile_developer", "product_manager", "ux_designer",
            "security_engineer", "qa_engineer", "business_analyst"
    );

    public static final Set<String> DOMAINS = Set.of(
            "tech", "finance", "healthcare", "ecommerce", "edtech",
            "fintech", "saas", "gaming", "ai_ml", "cybersecurity",
            "cloud", "media", "social", "enterprise", "startup"
    );

    public static boolean isValidRole(String role) {
        return role == null || ROLES.contains(role);
    }

    public static boolean isValidDomain(String domain) {
        return domain == null || DOMAINS.contains(domain);
    }
}
