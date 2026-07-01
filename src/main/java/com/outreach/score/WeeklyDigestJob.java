package com.outreach.score;

import com.outreach.admin.ScheduledJobRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Monday 07:00 IST — weekly digest for all eligible users, batched in chunks of 50.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeeklyDigestJob {

    private final WeeklyDigestService weeklyDigestService;
    private final ScheduledJobRunner jobRunner;

    @Scheduled(cron = "0 0 7 * * MON", zone = "Asia/Kolkata")
    @SchedulerLock(name = "weekly_digest",
                   lockAtLeastFor = "PT10M",
                   lockAtMostFor = "PT2H")
    public void run() {
        jobRunner.run("weekly_digest", () -> {
            log.info("[WeeklyDigestJob] Starting weekly digest (Monday 07:00 IST)");
            WeeklyDigestService.DigestRunResult result = weeklyDigestService.runWeeklyDigest();
            log.info("[WeeklyDigestJob] Done — batches={} processed={} sent={} skipped={}",
                    result.batches(), result.processed(), result.sent(), result.skipped());
        });
    }
}
