package com.outreach.admin;

import com.outreach.admin.dto.AdminFeedbackItem;
import com.outreach.admin.dto.AdminStatsResponse;
import com.outreach.ai.AiInteractionRepository;
import com.outreach.billing.PaymentEventRepository;
import com.outreach.billing.SubscriptionRepository;
import com.outreach.admin.AuditEventService;
import com.outreach.common.exception.NotFoundException;
import com.outreach.feedback.Feedback;
import com.outreach.feedback.FeedbackRepository;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AdminAuthService adminAuthService;
    private final AiInteractionRepository aiInteractionRepository;
    private final UserEventRepository userEventRepository;
    private final PaymentEventRepository paymentEventRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final FailedJobTracker failedJobTracker;
    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final DataSource dataSource;
    private final RedisConnectionFactory redisConnectionFactory;
    private final AuditEventService auditEventService;

    @Transactional(readOnly = true)
    public AdminStatsResponse getStats(UUID adminUserId) {
        adminAuthService.requirePlatformAdmin(adminUserId);

        OffsetDateTime dayStart = OffsetDateTime.now(ZoneOffset.UTC).toLocalDate()
                .atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime dayEnd = dayStart.plusDays(1);

        YearMonth month = YearMonth.now(ZoneOffset.UTC);
        OffsetDateTime monthStart = month.atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime monthEnd = month.plusMonths(1).atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        BigDecimal aiCost = aiInteractionRepository.sumCostBetween(dayStart, dayEnd);
        long activeUsers = userEventRepository.countActiveUsersBetween(dayStart, dayEnd);
        long paymentRevenue = paymentEventRepository.sumAmountInrBetween(monthStart, monthEnd);
        long subscriptionRevenue = subscriptionRepository.sumActiveAmountInrStartedThisMonth(
                monthStart, monthEnd);
        long revenue = paymentRevenue + subscriptionRevenue;

        return AdminStatsResponse.builder()
                .aiCostToday(aiCost != null ? aiCost : BigDecimal.ZERO)
                .activeUsersToday(activeUsers)
                .revenueThisMonthInr(revenue)
                .failedJobs(failedJobTracker.getCount())
                .systemStatus(checkSystemStatus())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<AdminFeedbackItem> listFeedback(UUID adminUserId, Pageable pageable) {
        adminAuthService.requirePlatformAdmin(adminUserId);
        return feedbackRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(this::toAdminItem);
    }

    @Transactional
    public void suspendUser(UUID adminUserId, UUID targetUserId) {
        adminAuthService.requirePlatformAdmin(adminUserId);
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        target.setIsSuspended(true);
        userRepository.save(target);
        auditEventService.record(adminUserId, AuditEventService.USER_SUSPENDED, java.util.Map.of(
                "targetUserId", targetUserId.toString(),
                "targetEmail", target.getEmail()));
    }

    private AdminFeedbackItem toAdminItem(Feedback fb) {
        String email = fb.getUser() != null ? fb.getUser().getEmail() : null;
        UUID userId = fb.getUser() != null ? fb.getUser().getId() : null;
        return AdminFeedbackItem.builder()
                .id(fb.getId())
                .userId(userId)
                .userEmail(email)
                .message(fb.getMessage())
                .screen(fb.getScreen())
                .type(fb.getType())
                .createdAt(fb.getCreatedAt())
                .build();
    }

    private String checkSystemStatus() {
        boolean dbOk = pingDb();
        boolean redisOk = pingRedis();
        if (dbOk && redisOk) return "healthy";
        if (dbOk || redisOk) return "degraded";
        return "down";
    }

    private boolean pingDb() {
        try (Connection c = dataSource.getConnection()) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean pingRedis() {
        try {
            return "PONG".equalsIgnoreCase(
                    redisConnectionFactory.getConnection().ping());
        } catch (Exception e) {
            return false;
        }
    }
}
