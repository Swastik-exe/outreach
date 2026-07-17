package com.outreach.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.outreach.billing.dto.CheckoutResponse;
import com.outreach.billing.dto.SubscriptionInfoResponse;
import com.outreach.billing.dto.UsageResponse;
import com.outreach.common.exception.BadRequestException;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Subscription lifecycle: checkout, lazy expiry (D13), activation after webhook.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionRepository subRepo;
    private final PaymentEventRepository paymentRepo;
    private final UserRepository userRepo;
    private final RazorpayClient razorpayClient;
    private final RazorpayConfig razorpayConfig;
    private final PlanConfig planConfig;
    @Lazy
    private final QuotaService quotaService;

    // ── Checkout ──────────────────────────────────────────────────────────────

    @Transactional
    public CheckoutResponse checkout(UUID userId, String plan) {
        String normalized = normalizePlan(plan);
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));

        int amountInr = planConfig.amountInr(normalized);
        PlanTier targetTier = planConfig.targetTier(normalized);
        boolean seasonPass = planConfig.isSeasonPass(normalized);

        Subscription sub = subRepo.findByUserId(userId).orElseGet(() ->
                Subscription.builder()
                        .user(user)
                        .plan(PlanTier.free)
                        .status(SubStatus.past_due)
                        .isSeasonPass(false)
                        .createdAt(OffsetDateTime.now())
                        .updatedAt(OffsetDateTime.now())
                        .build()
        );

        sub.setPlan(targetTier);
        sub.setAmountInr(amountInr);
        sub.setIsSeasonPass(seasonPass);
        sub.setStatus(SubStatus.past_due);
        sub.setUpdatedAt(OffsetDateTime.now());

        try {
            if (seasonPass) {
                String orderId = razorpayClient.createOrder(
                        planConfig.amountPaise(normalized),
                        "season_" + userId.toString().substring(0, 8));
                sub.setRazorpayOrderId(orderId);
                sub.setRazorpaySubscriptionId(null);
                subRepo.save(sub);
                return new CheckoutResponse(
                        razorpayConfig.isSandbox() ? "rzp_test_sandbox" : razorpayConfig.getKeyId(),
                        orderId,
                        null,
                        amountInr,
                        "INR",
                        normalized,
                        razorpayConfig.isSandbox(),
                        user.getEmail()
                );
            } else {
                String planId = normalized.equals("annual")
                        ? planConfig.planAnnualId()
                        : planConfig.planMonthlyId();
                int totalCount = normalized.equals("annual") ? 1 : 12;
                String subId = razorpayClient.createSubscription(planId, totalCount);
                sub.setRazorpaySubscriptionId(subId);
                sub.setRazorpayOrderId(null);
                sub.setIsSeasonPass(false);
                subRepo.save(sub);
                return new CheckoutResponse(
                        razorpayConfig.isSandbox() ? "rzp_test_sandbox" : razorpayConfig.getKeyId(),
                        null,
                        subId,
                        amountInr,
                        "INR",
                        normalized,
                        razorpayConfig.isSandbox(),
                        user.getEmail()
                );
            }
        } catch (Exception e) {
            log.error("Checkout failed for user {} plan {}: {}", userId, plan, e.getMessage());
            throw new BadRequestException("Could not start checkout: " + e.getMessage());
        }
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    /**
     * User-initiated cancellation. Stops future Razorpay charges immediately but
     * leaves the current paid period intact — access lapses at {@code periodEnd}
     * via {@link #applyLazyExpiry}. Season Pass is a one-time purchase and cannot
     * be cancelled.
     */
    @Transactional
    public SubscriptionInfoResponse cancel(UUID userId) {
        Subscription sub = subRepo.findByUserId(userId)
                .orElseThrow(() -> new BadRequestException("No subscription to cancel."));

        if (sub.getStatus() != SubStatus.active) {
            throw new BadRequestException("No active subscription to cancel.");
        }
        if (Boolean.TRUE.equals(sub.getIsSeasonPass())) {
            throw new BadRequestException(
                    "The Season Pass is a one-time purchase and doesn't renew — there's nothing to cancel.");
        }

        if (sub.getRazorpaySubscriptionId() != null) {
            try {
                razorpayClient.cancelSubscription(sub.getRazorpaySubscriptionId());
            } catch (Exception e) {
                log.error("Razorpay cancel failed for subscription {}: {}",
                        sub.getRazorpaySubscriptionId(), e.getMessage());
                throw new BadRequestException(
                        "Could not cancel with the payment provider. Please try again in a moment.");
            }
        }

        sub.setStatus(SubStatus.cancelled);
        sub.setUpdatedAt(OffsetDateTime.now());
        subRepo.save(sub);
        log.info("User {} cancelled subscription {} — access until {}",
                userId, sub.getRazorpaySubscriptionId(), sub.getPeriodEnd());

        return getSubscriptionInfo(userId);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    @Transactional
    public SubscriptionInfoResponse getSubscriptionInfo(UUID userId) {
        applyLazyExpiry(userId);
        User user = userRepo.findById(userId).orElseThrow();
        Subscription sub = subRepo.findByUserId(userId).orElse(null);

        boolean expired = sub != null && isExpired(sub);
        return new SubscriptionInfoResponse(
                user.getPlanTier().name(),
                sub != null ? sub.getStatus().name() : "none",
                Boolean.TRUE.equals(sub != null ? sub.getIsSeasonPass() : false),
                sub != null ? sub.getAmountInr() : null,
                sub != null ? sub.getPeriodStart() : null,
                sub != null ? sub.getPeriodEnd() : null,
                expired,
                quotaService.usageForUser(userId)
        );
    }

    @Transactional
    public UsageResponse getUsage(UUID userId) {
        applyLazyExpiry(userId);
        User user = userRepo.findById(userId).orElseThrow();
        return new UsageResponse(user.getPlanTier().name(), quotaService.usageForUser(userId));
    }

    /** Effective tier after lazy expiry — used by QuotaService. */
    @Transactional
    public PlanTier effectivePlanTier(UUID userId) {
        applyLazyExpiry(userId);
        return userRepo.findById(userId).map(User::getPlanTier).orElse(PlanTier.free);
    }

    // ── Webhook activation (called inside one TX after payment_events insert) ─

    /**
     * Process a verified Razorpay webhook inside a single transaction.
     * Inserts payment_events FIRST; duplicate provider_event_id aborts before activation.
     */
    @Transactional
    public void processWebhookEvent(String providerEventId, String eventType,
                                    String rawBody, JsonNode root) {
        // Idempotency: insert event row first (D15)
        PaymentEvent event = PaymentEvent.builder()
                .eventType(eventType)
                .providerEventId(providerEventId)
                .metadata(rawBody)
                .createdAt(OffsetDateTime.now())
                .build();

        try {
            paymentRepo.saveAndFlush(event);
        } catch (DataIntegrityViolationException ex) {
            log.info("Duplicate webhook event {} — skipping activation", providerEventId);
            throw ex; // controller catches and returns 200
        }

        switch (eventType) {
            case "payment.captured", "order.paid" -> handleOrderPaid(root, event);
            case "subscription.activated", "subscription.charged" -> handleSubscriptionActive(root, event);
            case "subscription.cancelled", "subscription.completed" -> handleSubscriptionEnded(root);
            default -> log.debug("Ignoring Razorpay event type: {}", eventType);
        }
    }

    private void handleOrderPaid(JsonNode root, PaymentEvent event) {
        String orderId = extractOrderId(root);
        if (orderId == null) return;

        Subscription sub = subRepo.findByRazorpayOrderId(orderId).orElse(null);
        if (sub == null) {
            log.warn("No subscription row for order {}", orderId);
            return;
        }

        int amount = root.path("payload").path("payment").path("entity").path("amount")
                .asInt(planConfig.seasonPassInr() * 100) / 100;
        event.setUser(sub.getUser());
        event.setAmountInr(amount > 0 ? amount : planConfig.seasonPassInr());
        paymentRepo.save(event);

        activate(sub, PlanTier.pass_holder, true, PlanConfig.SEASON_PASS_MONTHS);
    }

    private void handleSubscriptionActive(JsonNode root, PaymentEvent event) {
        String subId = root.path("payload").path("subscription").path("entity").path("id").asText(null);
        if (subId == null) return;

        Subscription sub = subRepo.findByRazorpaySubscriptionId(subId).orElse(null);
        if (sub == null) {
            log.warn("No subscription row for razorpay subscription {}", subId);
            return;
        }

        event.setUser(sub.getUser());
        event.setAmountInr(sub.getAmountInr());
        paymentRepo.save(event);

        int months = sub.getAmountInr() != null && sub.getAmountInr() >= planConfig.annualInr()
                ? 12 : 1;
        activate(sub, PlanTier.premium, false, months);
    }

    private void handleSubscriptionEnded(JsonNode root) {
        String subId = root.path("payload").path("subscription").path("entity").path("id").asText(null);
        if (subId == null) return;
        subRepo.findByRazorpaySubscriptionId(subId).ifPresent(sub -> {
            sub.setStatus(SubStatus.cancelled);
            sub.setUpdatedAt(OffsetDateTime.now());
            subRepo.save(sub);
            demoteUser(sub.getUser());
        });
    }

    private void activate(Subscription sub, PlanTier tier, boolean seasonPass, int periodMonths) {
        OffsetDateTime now = OffsetDateTime.now();
        sub.setStatus(SubStatus.active);
        sub.setPlan(tier);
        sub.setIsSeasonPass(seasonPass);
        sub.setPeriodStart(now);
        sub.setPeriodEnd(now.plusMonths(periodMonths));
        sub.setUpdatedAt(now);
        subRepo.save(sub);

        User user = sub.getUser();
        user.setPlanTier(tier);
        user.setUpdatedAt(now);
        userRepo.save(user);

        quotaService.syncLimitsForPlan(user.getId(), tier);
        log.info("Activated plan {} for user {} until {}", tier, user.getId(), sub.getPeriodEnd());
    }

    // ── Lazy expiry (D13) ─────────────────────────────────────────────────────

    @Transactional
    public void applyLazyExpiry(UUID userId) {
        subRepo.findByUserId(userId).ifPresent(sub -> {
            boolean stillEntitled = sub.getStatus() == SubStatus.active
                    || sub.getStatus() == SubStatus.cancelled;
            if (stillEntitled && isExpired(sub)) {
                sub.setStatus(SubStatus.expired);
                sub.setUpdatedAt(OffsetDateTime.now());
                subRepo.save(sub);
                demoteUser(sub.getUser());
                log.info("Lazy-expired subscription for user {}", userId);
            }
        });
    }

    /** Optional reporting sweep — flips status only; access already blocked by lazy check. */
    @Transactional
    public int sweepExpiredSubscriptions() {
        OffsetDateTime now = OffsetDateTime.now();
        int count = 0;
        for (Subscription sub : subRepo.findAll()) {
            if (sub.getStatus() == SubStatus.active
                    && sub.getPeriodEnd() != null
                    && sub.getPeriodEnd().isBefore(now)) {
                sub.setStatus(SubStatus.expired);
                sub.setUpdatedAt(now);
                subRepo.save(sub);
                demoteUser(sub.getUser());
                count++;
            }
        }
        return count;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void demoteUser(User user) {
        user.setPlanTier(PlanTier.free);
        user.setUpdatedAt(OffsetDateTime.now());
        userRepo.save(user);
        quotaService.syncLimitsForPlan(user.getId(), PlanTier.free);
    }

    static boolean isExpired(Subscription sub) {
        return sub.getPeriodEnd() != null && sub.getPeriodEnd().isBefore(OffsetDateTime.now());
    }

    private static String extractOrderId(JsonNode root) {
        JsonNode payment = root.path("payload").path("payment").path("entity");
        if (!payment.isMissingNode()) {
            String oid = payment.path("order_id").asText(null);
            if (oid != null) return oid;
        }
        JsonNode order = root.path("payload").path("order").path("entity");
        if (!order.isMissingNode()) {
            return order.path("id").asText(null);
        }
        return null;
    }

    private static String normalizePlan(String plan) {
        if (plan == null || plan.isBlank()) {
            throw new BadRequestException("plan is required (monthly, annual, or seasonPass)");
        }
        return plan.trim();
    }

    private int monthsForPlan(String plan) {
        return switch (plan.toLowerCase()) {
            case "annual" -> 12;
            case "monthly" -> 1;
            default -> PlanConfig.SEASON_PASS_MONTHS;
        };
    }
}
