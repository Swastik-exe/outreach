package com.outreach.tracker.inbound;

import com.outreach.admin.ScheduledJobRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DraftPurgeJob {

    private static final int PURGE_AFTER_DAYS = 14;

    private final InboundEmailDraftRepository draftRepo;
    private final ScheduledJobRunner jobRunner;

    @Scheduled(cron = "0 30 2 * * *", zone = "Asia/Kolkata")
    @SchedulerLock(name = "draft_ttl_purge",
                   lockAtLeastFor = "PT1M",
                   lockAtMostFor  = "PT10M")
    @Transactional
    public void run() {
        jobRunner.run("draft_ttl_purge", () -> {
            OffsetDateTime cutoff = OffsetDateTime.now().minusDays(PURGE_AFTER_DAYS);
            int purged = draftRepo.purgeRawPayload(cutoff);
            log.info("DraftPurgeJob: nulled raw_payload for {} drafts older than {} days",
                    purged, PURGE_AFTER_DAYS);
        });
    }
}
