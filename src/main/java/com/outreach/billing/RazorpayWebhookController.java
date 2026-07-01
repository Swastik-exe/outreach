package com.outreach.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Razorpay webhook endpoint (PUBLIC — signature verified, not JWT).
 *
 * Order (D15): verify HMAC-SHA256 on RAW body → parse → one TX:
 * INSERT payment_events FIRST (unique provider_event_id) → activate plan.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class RazorpayWebhookController {

    private final RazorpayConfig razorpayConfig;
    private final RazorpaySignatureVerifier signatureVerifier;
    private final SubscriptionService subscriptionService;
    private final ObjectMapper objectMapper;

    @PostMapping("/razorpay")
    public ResponseEntity<ApiResponse<Void>> handle(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        // (a) Verify signature BEFORE any DB read/write
        if (!razorpayConfig.isWebhookConfigured()) {
            log.error("RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Webhook not configured"));
        }

        if (!signatureVerifier.verify(rawBody, signature, razorpayConfig.getWebhookSecret())) {
            log.warn("Razorpay webhook: invalid signature");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid webhook signature"));
        }

        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String eventType = root.path("event").asText("unknown");
            String eventId = root.path("id").asText(null);
            if (eventId == null || eventId.isBlank()) {
                eventId = root.path("payload").path("payment").path("entity").path("id").asText(
                        "evt_" + System.currentTimeMillis());
            }

            subscriptionService.processWebhookEvent(eventId, eventType, rawBody, root);
            return ResponseEntity.ok(ApiResponse.ok(null));

        } catch (DataIntegrityViolationException ex) {
            // Duplicate provider_event_id — idempotency guard worked; no double activation
            log.info("Duplicate webhook (idempotent): {}", ex.getMostSpecificCause().getMessage());
            return ResponseEntity.ok(ApiResponse.ok(null));

        } catch (Exception ex) {
            log.error("Webhook processing failed: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Webhook processing failed"));
        }
    }
}
