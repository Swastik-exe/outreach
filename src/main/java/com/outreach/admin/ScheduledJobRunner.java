package com.outreach.admin;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Wraps {@code @Scheduled} job bodies — logs + increments {@link FailedJobTracker} on throw
 * without rethrowing (scheduler thread must keep running).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledJobRunner {

    private final FailedJobTracker failedJobTracker;

    public void run(String jobName, Runnable task) {
        try {
            task.run();
        } catch (Exception e) {
            log.error("[ScheduledJob] {} failed: {}", jobName, e.getMessage(), e);
            failedJobTracker.recordFailure(jobName);
        }
    }
}
