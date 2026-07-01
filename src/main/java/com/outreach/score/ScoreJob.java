package com.outreach.score;

import com.outreach.admin.ScheduledJobRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScoreJob {

    private final ScoreService scoreService;
    private final ScheduledJobRunner jobRunner;

    /** 02:00 IST — stale score recalculation (brain.md spec). */
    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Kolkata")
    @SchedulerLock(name = "score-stale-recalc", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void recalculateStaleScores() {
        jobRunner.run("score-stale-recalc", () -> {
            log.info("[ScoreJob] Starting stale-score recalculation");
            scoreService.recalculateStale();
            log.info("[ScoreJob] Stale-score recalculation complete");
        });
    }

    /** 02:30 IST — daily history snapshot (brain.md spec). */
    @Scheduled(cron = "0 30 2 * * *", zone = "Asia/Kolkata")
    @SchedulerLock(name = "score-history-snapshot", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void snapshotDailyHistory() {
        jobRunner.run("score-history-snapshot", () -> {
            log.info("[ScoreJob] Starting history snapshot");
            scoreService.snapshotHistory();
            log.info("[ScoreJob] History snapshot complete");
        });
    }
}
