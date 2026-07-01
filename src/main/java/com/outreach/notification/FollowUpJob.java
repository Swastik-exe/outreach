package com.outreach.notification;

import com.outreach.admin.ScheduledJobRunner;
import com.outreach.tracker.Application;
import com.outreach.tracker.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Daily 09:00 IST job: find all 'applied' apps with next_action_due in the past
 * and create a follow-up reminder notification for each.
 *
 * Redis key `followup:reminded:{appId}` (TTL 7 days) deduplicates so each app
 * gets at most one reminder per week even if it stays in 'applied' status.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FollowUpJob {

    private static final String REDIS_PREFIX = "followup:reminded:";
    private static final long   REMIND_TTL_DAYS = 7;
    private static final int    MAX_DRAFTS_PER_RUN = 500;  // guard against runaway DB scan

    private final ApplicationRepository appRepo;
    private final NotificationService   notifService;
    private final StringRedisTemplate   redis;
    private final ScheduledJobRunner    jobRunner;

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Kolkata")
    @SchedulerLock(name = "follow_up_reminder",
                   lockAtLeastFor = "PT5M",
                   lockAtMostFor  = "PT55M")
    public void run() {
        jobRunner.run("follow_up_reminder", this::doRun);
    }

    private void doRun() {
        log.info("FollowUpJob: scanning for overdue follow-ups (IST 09:00)");

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        List<Application> due = appRepo.findAllFollowUpsDue(now);

        log.info("FollowUpJob: {} apps overdue for follow-up", due.size());

        int notified = 0;
        int skipped  = 0;

        for (Application app : due) {
            String redisKey = REDIS_PREFIX + app.getId();

            // Skip if reminded recently (dedup via Redis TTL)
            if (Boolean.TRUE.equals(redis.hasKey(redisKey))) {
                skipped++;
                continue;
            }

            try {
                notifService.create(
                        app.getUser(),
                        "follow_up_reminder",
                        "Follow-up due: " + app.getCompany(),
                        "You applied to " + app.getRole() + " at " + app.getCompany()
                        + " and haven't heard back. Time to follow up!",
                        "/dashboard/applications/" + app.getId()
                );

                // Mark as reminded — TTL 7 days
                redis.opsForValue().set(redisKey, "1", REMIND_TTL_DAYS, TimeUnit.DAYS);
                notified++;

            } catch (Exception e) {
                log.error("FollowUpJob: failed to notify for app {}: {}", app.getId(), e.getMessage());
            }
        }

        log.info("FollowUpJob: notified={} skipped={}", notified, skipped);
    }
}
