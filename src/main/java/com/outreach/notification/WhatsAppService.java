package com.outreach.notification;

/**
 * Abstraction for WhatsApp message delivery.
 * Implementations: {@link WhatsAppServiceStub} (current), real provider (future).
 */
public interface WhatsAppService {
    /**
     * Sends a text message to the given number.
     * @return true if delivery was accepted, false if the send could not be attempted.
     */
    boolean send(String phoneNumber, String message);
}
