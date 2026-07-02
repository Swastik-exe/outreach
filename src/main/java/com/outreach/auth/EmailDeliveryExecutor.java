package com.outreach.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Runs email delivery off the HTTP thread so register/login/forgot-password respond fast.
 */
@Slf4j
@Service
public class EmailDeliveryExecutor {

    @Async("freePool")
    public void run(Runnable task) {
        try {
            task.run();
        } catch (Exception e) {
            log.warn("Async email task failed: {}", e.getMessage());
        }
    }
}
