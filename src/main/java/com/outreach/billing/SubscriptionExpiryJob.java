package com.outreach.billing;

import com.outreach.admin.ScheduledJobRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionExpiryJob {

    private final SubscriptionService subscriptionService;
    private final ScheduledJobRunner jobRunner;

    @Scheduled(cron = "0 15 3 * * *", zone = "Asia/Kolkata")
    @SchedulerLock(name = "subscription_expiry_sweep",
                   lockAtLeastFor = "PT1M",
                   lockAtMostFor = "PT10M")
    public void run() {
        jobRunner.run("subscription_expiry_sweep", () -> {
            int count = subscriptionService.sweepExpiredSubscriptions();
            if (count > 0) {
                log.info("SubscriptionExpiryJob: marked {} subscription(s) expired", count);
            }
        });
    }
}
