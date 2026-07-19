package com.outreach.auth;

import com.outreach.admin.ScheduledJobRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Hard-deletes expired/used auth artifacts that are safe to remove.
 * Never deletes active or unexpired sessions (reuse-detection rows stay until expires_at).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExpiredAuthPurgeJob {

    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserSessionRepository userSessionRepository;
    private final ScheduledJobRunner jobRunner;

    @Scheduled(cron = "0 45 3 * * *", zone = "Asia/Kolkata")
    @SchedulerLock(name = "expired_auth_purge",
                   lockAtLeastFor = "PT1M",
                   lockAtMostFor = "PT10M")
    @Transactional
    public void run() {
        jobRunner.run("expired_auth_purge", () -> {
            OffsetDateTime now = OffsetDateTime.now();
            int verification = emailVerificationTokenRepository.deleteExpiredOrUsedBefore(now, now);
            int resets = passwordResetTokenRepository.deleteExpiredOrUsedBefore(now, now);
            int sessions = userSessionRepository.deleteExpiredBefore(now);
            log.info(
                    "ExpiredAuthPurgeJob: deleted verificationTokens={} passwordResetTokens={} sessions={}",
                    verification, resets, sessions);
        });
    }
}
