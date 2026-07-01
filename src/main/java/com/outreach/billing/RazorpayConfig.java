package com.outreach.billing;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Razorpay credentials from env. If key id/secret are blank, the app runs in
 * clearly-logged sandbox mode — checkout returns mock IDs, never crashes boot.
 */
@Slf4j
@Getter
@Component
public class RazorpayConfig {

    private final String keyId;
    private final String keySecret;
    private final String webhookSecret;
    private final boolean sandbox;

    public RazorpayConfig(
            @Value("${app.razorpay.key-id:}") String keyId,
            @Value("${app.razorpay.key-secret:}") String keySecret,
            @Value("${app.razorpay.webhook-secret:}") String webhookSecret) {
        this.keyId = keyId;
        this.keySecret = keySecret;
        this.webhookSecret = webhookSecret;
        this.sandbox = keyId == null || keyId.isBlank()
                || keySecret == null || keySecret.isBlank();

        if (sandbox) {
            log.warn("=== RAZORPAY SANDBOX MODE === key-id/secret not configured. "
                    + "Checkout returns mock IDs; configure RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET for live API calls.");
        } else {
            log.info("Razorpay configured (key id present). Webhook secret {}",
                    webhookSecret != null && !webhookSecret.isBlank() ? "configured" : "MISSING — webhooks will reject");
        }
    }

    public boolean isWebhookConfigured() {
        return webhookSecret != null && !webhookSecret.isBlank();
    }
}
