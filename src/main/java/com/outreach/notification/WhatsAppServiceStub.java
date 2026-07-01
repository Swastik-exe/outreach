package com.outreach.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Stub — logs the message content.
 * Replace with a real WhatsApp Business API (e.g. Meta / Twilio) when needed.
 * Per-endpoint limiting deferred; channel resolution is the gate: only called
 * when the user has a verified whatsapp_number + notif_channel='whatsapp'.
 */
@Slf4j
@Service
public class WhatsAppServiceStub implements WhatsAppService {

    @Override
    public boolean send(String phoneNumber, String message) {
        log.info("=== WHATSAPP (stub): to={} message='{}' ===", phoneNumber,
                message.length() > 80 ? message.substring(0, 80) + "…" : message);
        return true;
    }
}
