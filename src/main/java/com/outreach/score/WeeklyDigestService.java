package com.outreach.score;

import com.outreach.notification.NotificationService;
import com.outreach.tracker.ApplicationRepository;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Composes and delivers weekly digests via {@link NotificationService}.
 * Pages through ALL eligible users in batches — never stops after the first batch.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeeklyDigestService {

    static final int BATCH_SIZE = 50;
    private static final String REDIS_BAND_PREFIX = "digest:cohort_band:";

    private final UserRepository userRepository;
    private final CareerHealthScoreRepository scoreRepository;
    private final CareerHealthHistoryRepository historyRepository;
    private final ApplicationRepository applicationRepository;
    private final CohortService cohortService;
    private final NotificationService notificationService;
    private final StringRedisTemplate redis;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /** Result counters for verification / logging. */
    public record DigestRunResult(int batches, int processed, int sent, int skipped) {}

    @Transactional
    public DigestRunResult runWeeklyDigest() {
        int batches = 0;
        int processed = 0;
        int sent = 0;
        int skipped = 0;
        int page = 0;

        Page<User> batch;
        do {
            batch = userRepository.findDigestEligible(
                    PageRequest.of(page, BATCH_SIZE, Sort.by("id")));
            batches++;
            log.info("[WeeklyDigest] Batch {} — {} users (page size {})",
                    batches, batch.getNumberOfElements(), BATCH_SIZE);

            for (User user : batch.getContent()) {
                processed++;
                try {
                    if (composeAndSend(user)) {
                        sent++;
                    } else {
                        skipped++;
                    }
                } catch (Exception e) {
                    log.warn("[WeeklyDigest] Failed for user {}: {}", user.getId(), e.getMessage());
                    skipped++;
                }
            }
            page++;
        } while (batch.hasNext());

        log.info("[WeeklyDigest] Complete — batches={} processed={} sent={} skipped={}",
                batches, processed, sent, skipped);
        return new DigestRunResult(batches, processed, sent, skipped);
    }

    /** Returns true if a digest was sent. */
    boolean composeAndSend(User user) {
        UUID userId = user.getId();
        CareerHealthScore score = scoreRepository.findByUserId(userId).orElse(null);
        if (score == null || score.getOverallScore() == null) {
            return false;
        }

        int current = score.getOverallScore();
        int scoreChange = computeWeeklyChange(userId, current);

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        int followUpsDue = applicationRepository.findFollowUpsDue(userId, now).size();

        String insight = score.getNextAction();
        if (insight == null || insight.isBlank()) {
            insight = null;
        }

        var cohort = cohortService.getCohortInsight(userId);
        String bandChangedLine = null;
        if (cohort.available()) {
            String redisKey = REDIS_BAND_PREFIX + userId;
            String previous = redis.opsForValue().get(redisKey);
            String currentBand = cohort.band();
            if (previous != null && !previous.equals(currentBand)) {
                bandChangedLine = "Cohort rank updated: now " + currentBand;
            }
            redis.opsForValue().set(redisKey, currentBand);
        }

        if (scoreChange == 0 && followUpsDue == 0 && insight == null && bandChangedLine == null) {
            return false;
        }

        StringBuilder body = new StringBuilder();
        if (scoreChange != 0) {
            body.append("Score change this week: ")
                    .append(scoreChange >= 0 ? "+" : "")
                    .append(scoreChange)
                    .append(" (now ")
                    .append(current)
                    .append("/1000).\n");
        }
        if (followUpsDue > 0) {
            body.append("Follow-ups due: ")
                    .append(followUpsDue)
                    .append(followUpsDue == 1 ? " application" : " applications")
                    .append(".\n");
        }
        if (insight != null) {
            body.append("Insight: ").append(insight).append("\n");
        }
        if (bandChangedLine != null) {
            body.append(bandChangedLine).append("\n");
        }

        notificationService.create(
                user,
                "weekly_digest",
                "Your weekly Outreach digest",
                body.toString().trim(),
                frontendUrl + "/dashboard"
        );
        return true;
    }

    private int computeWeeklyChange(UUID userId, int current) {
        LocalDate weekAgo = LocalDate.now().minusDays(7);
        return historyRepository.findByUserIdAndRecordedDate(userId, weekAgo)
                .map(h -> current - (h.getOverallScore() != null ? h.getOverallScore() : 0))
                .orElse(0);
    }
}
