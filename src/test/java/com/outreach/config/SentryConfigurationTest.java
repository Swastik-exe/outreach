package com.outreach.config;

import io.sentry.Breadcrumb;
import io.sentry.SentryEvent;
import io.sentry.protocol.Message;
import io.sentry.protocol.Request;
import io.sentry.protocol.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SentryConfigurationTest {

    @Test
    void scrubsRequestUserBreadcrumbsExtrasAndSensitiveMessageText() {
        SentryEvent event = new SentryEvent();
        event.setRequest(new Request());
        event.setUser(new User());
        event.setBreadcrumbs(List.of(new Breadcrumb("resume content")));
        event.setExtra("payload", "private resume content");

        Message message = new Message();
        message.setMessage("user@example.com Bearer secret token=abc");
        event.setMessage(message);

        SentryConfiguration.scrub(event);

        assertNull(event.getRequest());
        assertNull(event.getUser());
        assertTrue(event.getBreadcrumbs().isEmpty());
        assertTrue(event.getExtras().isEmpty());
        assertEquals(
                "[redacted-email] Bearer [redacted] token=[redacted]",
                event.getMessage().getMessage());
    }
}
