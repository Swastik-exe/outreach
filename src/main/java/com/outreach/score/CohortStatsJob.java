package com.outreach.score;

import com.outreach.admin.ScheduledJobRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily 02:30 IST — recompute cohort_size, p25/p50/p75/p90, and score_histogram
 * from users' overall_score per controlled cohort_key (D2).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CohortStatsJob {

    private final CohortService cohortService;
    private final ScheduledJobRunner jobRunner;

    @Scheduled(cron = "0 30 2 * * *", zone = "Asia/Kolkata")
    @SchedulerLock(name = "cohort_stats_recompute",
                   lockAtLeastFor = "PT5M",
                   lockAtMostFor = "PT55M")
    public void run() {
        jobRunner.run("cohort_stats_recompute", () -> {
            log.info("[CohortStatsJob] Starting cohort stats recompute (02:30 IST)");
            int count = cohortService.recomputeAllCohorts();
            log.info("[CohortStatsJob] Complete — {} cohorts updated", count);
        });
    }
}
