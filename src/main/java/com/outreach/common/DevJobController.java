package com.outreach.common;

import com.outreach.score.WeeklyDigestService;
import com.outreach.score.CohortService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Dev-only job triggers for verification scripts (secret-gated, same pattern as inbound webhook).
 */
@RestController
@RequestMapping("/api/v1/dev")
@Profile("dev")
@RequiredArgsConstructor
public class DevJobController {

    private final CohortService cohortService;
    private final WeeklyDigestService weeklyDigestService;

    @Value("${app.inbound.webhook-secret:}")
    private String webhookSecret;

    @PostMapping("/jobs/cohort-stats")
    public ResponseEntity<ApiResponse<Integer>> runCohortStats(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret) {
        requireSecret(secret);
        int updated = cohortService.recomputeAllCohorts();
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    @PostMapping("/jobs/weekly-digest")
    public ResponseEntity<ApiResponse<WeeklyDigestService.DigestRunResult>> runWeeklyDigest(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret) {
        requireSecret(secret);
        return ResponseEntity.ok(ApiResponse.ok(weeklyDigestService.runWeeklyDigest()));
    }

    private void requireSecret(String secret) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new IllegalStateException("Dev jobs disabled — set INBOUND_WEBHOOK_SECRET");
        }
        if (secret == null || !webhookSecret.equals(secret)) {
            throw new org.springframework.security.access.AccessDeniedException("Invalid webhook secret");
        }
    }
}
