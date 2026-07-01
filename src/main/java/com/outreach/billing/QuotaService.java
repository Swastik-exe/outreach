package com.outreach.billing;

import com.outreach.billing.dto.UsageMetricResponse;
import com.outreach.common.exception.TooManyRequestsException;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Per-user quota management with lazy reset (D14).
 * {@code resets_at} is the single source of truth — no global monthly job.
 */
@Service
public class QuotaService {

    private static final int RESET_DAYS = 30;

    private final UsageQuotaRepository quotaRepo;
    private final PlanConfig planConfig;
    private final SubscriptionService subscriptionService;

    public QuotaService(UsageQuotaRepository quotaRepo,
                        PlanConfig planConfig,
                        @Lazy SubscriptionService subscriptionService) {
        this.quotaRepo = quotaRepo;
        this.planConfig = planConfig;
        this.subscriptionService = subscriptionService;
    }

    /** Ensures row exists with limit matching the user's effective plan tier. */
    @Transactional
    public void ensureMetric(UUID userId, String metric) {
        PlanTier tier = subscriptionService.effectivePlanTier(userId);
        int limit = planConfig.quotaLimit(tier);
        OffsetDateTime now = OffsetDateTime.now();
        quotaRepo.ensureRow(userId, metric, limit, now.plusDays(RESET_DAYS));
        quotaRepo.lazyResetIfDue(userId, metric, now, now.plusDays(RESET_DAYS));
        quotaRepo.updateLimit(userId, metric, limit);
    }

    /**
     * Atomic consume one unit. Lazy-resets first, then increments.
     * @throws TooManyRequestsException if at limit (HTTP 429)
     */
    @Transactional
    public void consume(UUID userId, String metric) {
        ensureMetric(userId, metric);
        OffsetDateTime now = OffsetDateTime.now();
        int updated = quotaRepo.atomicIncrement(userId, metric, now);
        if (updated == 0) {
            throw new TooManyRequestsException(
                    "Quota reached for " + metric + ". Upgrade your plan for more.");
        }
    }

    @Transactional
    public void refund(UUID userId, String metric) {
        quotaRepo.atomicDecrement(userId, metric);
    }

    /** Called after plan activation — bump limits without resetting used count. */
    @Transactional
    public void syncLimitsForPlan(UUID userId, PlanTier tier) {
        int limit = planConfig.quotaLimit(tier);
        OffsetDateTime now = OffsetDateTime.now();
        quotaRepo.ensureRow(userId, PlanConfig.METRIC_RESUME, limit, now.plusDays(RESET_DAYS));
        quotaRepo.updateLimit(userId, PlanConfig.METRIC_RESUME, limit);
    }

    @Transactional
    public List<UsageMetricResponse> usageForUser(UUID userId) {
        ensureMetric(userId, PlanConfig.METRIC_RESUME);
        return quotaRepo.findByUserId(userId).stream()
                .map(q -> new UsageMetricResponse(
                        q.getMetric(),
                        q.getUsed() != null ? q.getUsed() : 0,
                        q.getQuotaLimit(),
                        q.getResetsAt()
                ))
                .toList();
    }
}
