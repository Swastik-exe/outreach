package com.outreach.tracker.inbound;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.common.ApiResponse;
import com.outreach.tracker.inbound.dto.InboundWebhookPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.concurrent.TimeUnit;

/**
 * Receives forwarded emails from a Cloudflare Email Routing worker (or any provider).
 *
 * Security (C7):
 *   1. Verify X-Webhook-Secret BEFORE any DB write — reject early if absent/wrong.
 *   2. All email fields are UNTRUSTED: sanitized + size-limited.
 *   3. Per-user rate limit: max 30 emails/hour.
 *   4. Per-user draft cap: max 20 pending drafts.
 *
 * This endpoint is NOT protected by JWT — it is called by the email routing worker,
 * not the user. The shared secret is the authentication mechanism.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/inbound-email")
@RequiredArgsConstructor
public class InboundEmailWebhookController {

    private static final int MAX_SUBJECT_LEN  = 500;
    private static final int MAX_BODY_LEN     = 50_000;
    private static final int RATE_LIMIT_MAX   = 30;
    private static final int DRAFT_CAP        = 20;
    private static final String RATE_KEY_PREFIX = "inbound:rate:";

    @Value("${app.inbound.webhook-secret:}")
    private String webhookSecret;

    private final ForwardingAddressRepository forwardingRepo;
    private final InboundEmailDraftRepository draftRepo;
    private final EmailParseService            parseService;
    private final StringRedisTemplate          redis;
    private final ObjectMapper                 objectMapper;

    @PostMapping("/webhook")
    public ResponseEntity<ApiResponse<Void>> receive(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret,
            @RequestBody InboundWebhookPayload payload) {

        // ── 1. Verify shared secret BEFORE any DB write ────────────────────────
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.error("INBOUND_WEBHOOK_SECRET is not configured — rejecting all inbound emails");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Inbound email not configured"));
        }
        if (!webhookSecret.equals(secret)) {
            log.warn("Inbound webhook: invalid secret from unknown caller");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid webhook secret"));
        }

        // ── 2. Resolve forwarding address → user ──────────────────────────────
        if (payload.to() == null || payload.to().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Missing 'to' field"));
        }

        ForwardingAddress fa = forwardingRepo.findByAddress(payload.to().trim()).orElse(null);
        if (fa == null) {
            log.warn("Inbound webhook: no forwarding address for '{}'", payload.to());
            return ResponseEntity.ok(ApiResponse.ok(null));  // silently accept (no retry storms)
        }

        var user   = fa.getUser();
        var userId = user.getId();

        // ── 3. Per-user rate limit (Redis sliding counter) ────────────────────
        String rateKey = RATE_KEY_PREFIX + userId + ":" + currentHour();
        Long count = redis.opsForValue().increment(rateKey);
        redis.expire(rateKey, 2, TimeUnit.HOURS);

        if (count != null && count > RATE_LIMIT_MAX) {
            log.warn("Inbound rate limit exceeded for user {}", userId);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("Inbound email rate limit exceeded"));
        }

        // ── 4. Per-user draft cap ─────────────────────────────────────────────
        long pendingCount = draftRepo.findByUserIdAndStatus(userId, "pending_confirm").size();
        if (pendingCount >= DRAFT_CAP) {
            log.warn("Draft cap ({}) reached for user {}", DRAFT_CAP, userId);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("Draft cap reached. Confirm or discard existing drafts."));
        }

        // ── 5. Sanitize email fields ──────────────────────────────────────────
        String subject  = truncate(payload.subject(),  MAX_SUBJECT_LEN);
        String bodyText = truncate(payload.bodyText(),  MAX_BODY_LEN);

        // ── 6. Parse with AI or regex ─────────────────────────────────────────
        EmailParseResult parsed = parseService.parse(subject, bodyText);

        // ── 7. Persist raw payload (will be TTL-purged after confirm/discard) ──
        String rawPayloadJson;
        try {
            rawPayloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            rawPayloadJson = "{\"error\":\"serialize failed\"}";
        }

        InboundEmailDraft draft = InboundEmailDraft.builder()
                .user(user)
                .rawPayload(rawPayloadJson)
                .parsedCompany(parsed.company())
                .parsedRole(parsed.role())
                .parsedDate(parsed.appliedDate())
                .confidence(parsed.confidence())
                .status("pending_confirm")
                .createdAt(OffsetDateTime.now())
                .build();

        draftRepo.save(draft);

        log.info("Inbound email ingested for user={} draftId={} company='{}' role='{}' confidence={}",
                userId, draft.getId(), parsed.company(), parsed.role(), parsed.confidence());

        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String currentHour() {
        OffsetDateTime now = OffsetDateTime.now();
        return now.getYear() + "-" + now.getMonthValue() + "-" + now.getDayOfMonth()
                + "T" + now.getHour();
    }
}
