package com.outreach.tracker.inbound.dto;

/**
 * JSON payload sent by the Cloudflare Email Routing worker (or any forwarding provider).
 *
 * Fields are intentionally all-Optional — we sanitize and size-limit everything
 * before touching the DB.  The payload is UNTRUSTED: treat it as adversarial input.
 */
public record InboundWebhookPayload(
        String to,            // u_{token}@track.outreachos.com
        String from,          // original sender
        String subject,       // email subject
        String bodyText,      // plain-text body (HTML stripped by the worker)
        String receivedAt     // ISO-8601 string; ignored if blank (we use now())
) {}
