package com.outreach.billing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Plan pricing (INR paise for Razorpay API) and quota limits.
 * Amounts in rupees for display; {@link #amountPaise(String)} for Razorpay.
 */
@Component
public class PlanConfig {

    public static final String METRIC_RESUME = "resume_analyses";

    public static final int FREE_RESUME_LIMIT = 3;
    public static final int PASS_RESUME_LIMIT = 20;
    public static final int PREMIUM_RESUME_LIMIT = 100;

    /** Season pass duration in months from activation. */
    public static final int SEASON_PASS_MONTHS = 6;

    private final int seasonPassInr;
    private final int monthlyInr;
    private final int annualInr;
    private final String planMonthlyId;
    private final String planAnnualId;

    public PlanConfig(
            @Value("${app.razorpay.pricing.season-pass-inr:499}") int seasonPassInr,
            @Value("${app.razorpay.pricing.monthly-inr:199}") int monthlyInr,
            @Value("${app.razorpay.pricing.annual-inr:1499}") int annualInr,
            @Value("${app.razorpay.plan-id.monthly:}") String planMonthlyId,
            @Value("${app.razorpay.plan-id.annual:}") String planAnnualId) {
        this.seasonPassInr = seasonPassInr;
        this.monthlyInr = monthlyInr;
        this.annualInr = annualInr;
        this.planMonthlyId = planMonthlyId;
        this.planAnnualId = planAnnualId;
    }

    public int seasonPassInr() { return seasonPassInr; }
    public int monthlyInr() { return monthlyInr; }
    public int annualInr() { return annualInr; }
    public String planMonthlyId() { return planMonthlyId; }
    public String planAnnualId() { return planAnnualId; }

    public int amountInr(String plan) {
        return switch (plan.toLowerCase()) {
            case "seasonpass", "season_pass" -> seasonPassInr;
            case "monthly" -> monthlyInr;
            case "annual" -> annualInr;
            default -> throw new IllegalArgumentException("Unknown plan: " + plan);
        };
    }

    public int amountPaise(String plan) {
        return amountInr(plan) * 100;
    }

    public PlanTier targetTier(String plan) {
        return switch (plan.toLowerCase()) {
            case "seasonpass", "season_pass" -> PlanTier.pass_holder;
            case "monthly", "annual" -> PlanTier.premium;
            default -> throw new IllegalArgumentException("Unknown plan: " + plan);
        };
    }

    public boolean isSeasonPass(String plan) {
        String p = plan.toLowerCase();
        return p.equals("seasonpass") || p.equals("season_pass");
    }

    public boolean isRecurring(String plan) {
        String p = plan.toLowerCase();
        return p.equals("monthly") || p.equals("annual");
    }

    public int quotaLimit(PlanTier tier) {
        return switch (tier) {
            case free -> FREE_RESUME_LIMIT;
            case pass_holder -> PASS_RESUME_LIMIT;
            case premium, admin -> PREMIUM_RESUME_LIMIT;
        };
    }

    /** Frontend-facing price map (rupees). */
    public Map<String, Object> publicPricing() {
        return Map.of(
                "seasonPass", Map.of(
                        "amountInr", seasonPassInr,
                        "label", "Season Pass",
                        "oneTime", true,
                        "months", SEASON_PASS_MONTHS
                ),
                "monthly", Map.of(
                        "amountInr", monthlyInr,
                        "label", "Premium Monthly",
                        "oneTime", false
                ),
                "annual", Map.of(
                        "amountInr", annualInr,
                        "label", "Premium Annual",
                        "oneTime", false,
                        "perMonthInr", Math.round(annualInr / 12.0)
                )
        );
    }
}
