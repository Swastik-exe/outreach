package com.outreach.config;

import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import io.sentry.protocol.SentryException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Last-mile privacy guard for error events before they leave the application.
 */
@Configuration
public class SentryConfiguration {

    private static final Pattern EMAIL = Pattern.compile(
            "(?i)[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
                    + "(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+");
    private static final Pattern BEARER_TOKEN = Pattern.compile("(?i)bearer\\s+\\S+");
    private static final Pattern JWT = Pattern.compile(
            "\\beyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\b");
    private static final Pattern TOKEN_PARAMETER = Pattern.compile(
            "(?i)(token|secret|password|authorization)=([^\\s&]+)");

    @Bean
    SentryOptions.BeforeSendCallback sentryPrivacyFilter() {
        return (event, hint) -> scrub(event);
    }

    static SentryEvent scrub(SentryEvent event) {
        // Request headers, cookies, query strings, bodies, breadcrumbs, and custom
        // extras are not required for triage and can contain authentication or
        // resume/email content.
        event.setRequest(null);
        event.setUser(null);
        event.setBreadcrumbs(Collections.emptyList());
        event.getExtras().clear();

        if (event.getMessage() != null) {
            event.getMessage().setMessage(redact(event.getMessage().getMessage()));
        }

        List<SentryException> exceptions = event.getExceptions();
        if (exceptions != null) {
            exceptions.forEach(exception -> exception.setValue(redact(exception.getValue())));
        }
        return event;
    }

    static String redact(String value) {
        if (value == null) {
            return null;
        }
        String redacted = EMAIL.matcher(value).replaceAll("[redacted-email]");
        redacted = BEARER_TOKEN.matcher(redacted).replaceAll("Bearer [redacted]");
        redacted = JWT.matcher(redacted).replaceAll("[redacted-token]");
        return TOKEN_PARAMETER.matcher(redacted).replaceAll("$1=[redacted]");
    }
}
