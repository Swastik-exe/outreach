package com.outreach.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.Map;

/**
 * Real email delivery via Resend (https://resend.com).
 *
 * Delivery is scheduled after DB commit and runs on {@code freePool} so auth
 * endpoints return immediately instead of waiting on Resend HTTP.
 *
 * Graceful degradation: if RESEND_API_KEY is blank or the send fails,
 * the email body is logged (grep-friendly VERIFY TOKEN / RESET TOKEN markers).
 */
@Slf4j
@Service
public class EmailNotificationService {

    private static final String RESEND_URL = "https://api.resend.com/emails";
    private static final Path DEBUG_LOG = Path.of("debug-d0dbd5.log");

    private final String apiKey;
    private final String fromAddress;
    private final String frontendUrl;
    private final HttpClient http;
    private final EmailDeliveryExecutor deliveryExecutor;

    public EmailNotificationService(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from:noreply@outreachos.com}") String fromAddress,
            @Value("${app.frontend-url:http://localhost:3000}") String frontendUrl,
            EmailDeliveryExecutor deliveryExecutor) {
        this.apiKey = apiKey;
        this.fromAddress = fromAddress;
        this.frontendUrl = frontendUrl;
        this.deliveryExecutor = deliveryExecutor;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public void sendVerificationEmail(String email, String rawToken) {
        String link = frontendUrl + "/verify-email?token=" + rawToken;
        String html = """
                <p>Welcome to Outreach!</p>
                <p>Click the link below to verify your email (valid 24 hours):</p>
                <p><a href="%s">Verify Email</a></p>
                <p>If you did not register, ignore this email.</p>
                """.formatted(link);
        scheduleDelivery(() -> send(email, "Verify your Outreach email", html,
                "VERIFY TOKEN " + rawToken, "verification"));
    }

    public void sendPasswordResetEmail(String email, String rawToken) {
        String link = frontendUrl + "/reset-password?token=" + rawToken;
        String html = """
                <p>You requested a password reset for your Outreach account.</p>
                <p>Click the link below to reset your password (valid 1 hour):</p>
                <p><a href="%s">Reset Password</a></p>
                <p>If you did not request this, ignore this email.</p>
                """.formatted(link);
        scheduleDelivery(() -> send(email, "Reset your Outreach password", html,
                "RESET TOKEN " + rawToken, "password-reset"));
    }

    public void sendExistingAccountEmail(String email, String rawToken) {
        String link = frontendUrl + "/reset-password?token=" + rawToken;
        String html = """
                <p>Someone tried to create a new Outreach account with this email address.</p>
                <p>You already have an account. Use the link below to sign in or reset your password (valid 1 hour):</p>
                <p><a href="%s">Access your account</a></p>
                <p>If this wasn't you, ignore this email.</p>
                """.formatted(link);
        scheduleDelivery(() -> send(email, "Your Outreach account already exists", html,
                "EXISTING ACCOUNT RESET " + rawToken, "existing-account"));
    }

    public void sendResendVerificationEmail(String email, String rawToken) {
        sendVerificationEmail(email, rawToken);
    }

    public void sendEmail(String to, String subject, String htmlBody) {
        scheduleDelivery(() -> send(to, subject, htmlBody,
                "EMAIL subject=" + subject + " to=" + to, "generic"));
    }

    /** After DB commit, deliver on a background thread (non-blocking for HTTP). */
    private void scheduleDelivery(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deliveryExecutor.run(task);
                }
            });
        } else {
            deliveryExecutor.run(task);
        }
    }

    private void send(String to, String subject, String htmlBody, String logMarker, String kind) {
        long start = System.currentTimeMillis();
        boolean keyPresent = apiKey != null && !apiKey.isBlank();
        // #region agent log
        debugLog("H8", "EmailNotificationService.send:start", "email delivery started",
                Map.of("kind", kind, "keyPresent", keyPresent, "toDomain", to.contains("@") ? to.substring(to.indexOf('@')) : "?"));
        // #endregion

        if (!keyPresent) {
            log.info("=== EMAIL (no RESEND_API_KEY — log only): to={} {} ===", to, logMarker);
            // #region agent log
            debugLog("H1", "EmailNotificationService.send:no-key", "email not sent — no API key",
                    Map.of("kind", kind, "ms", System.currentTimeMillis() - start));
            // #endregion
            return;
        }
        try {
            String body = """
                    {"from":"%s","to":["%s"],"subject":"%s","html":%s}
                    """.formatted(
                    fromAddress,
                    to,
                    subject.replace("\"", "\\\""),
                    jsonString(htmlBody)
            ).strip();

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(RESEND_URL))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            long ms = System.currentTimeMillis() - start;

            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                log.info("Email sent via Resend to={} subject={} ms={}", to, subject, ms);
                // #region agent log
                debugLog("H8", "EmailNotificationService.send:ok", "resend success",
                        Map.of("kind", kind, "status", resp.statusCode(), "ms", ms));
                // #endregion
            } else {
                log.warn("Resend returned status={} body={} — falling back to log", resp.statusCode(), resp.body());
                log.info("=== EMAIL (Resend error): to={} {} ===", to, logMarker);
                // #region agent log
                debugLog("H1", "EmailNotificationService.send:resend-error", "resend API error",
                        Map.of("kind", kind, "status", resp.statusCode(), "ms", ms));
                // #endregion
            }
        } catch (Exception e) {
            log.warn("Resend call failed ({}), logging email content instead", e.getMessage());
            log.info("=== EMAIL (send failed): to={} {} ===", to, logMarker);
            // #region agent log
            debugLog("H1", "EmailNotificationService.send:exception", "resend exception",
                    Map.of("kind", kind, "error", e.getClass().getSimpleName(), "ms", System.currentTimeMillis() - start));
            // #endregion
        }
    }

    // #region agent log
    private static void debugLog(String hypothesisId, String location, String message, Map<String, Object> data) {
        try {
            StringBuilder dataJson = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : data.entrySet()) {
                if (!first) dataJson.append(',');
                first = false;
                dataJson.append('"').append(e.getKey()).append("\":");
                Object v = e.getValue();
                if (v instanceof Number || v instanceof Boolean) {
                    dataJson.append(v);
                } else {
                    dataJson.append('"').append(String.valueOf(v).replace("\"", "\\\"")).append('"');
                }
            }
            dataJson.append('}');
            String line = "{\"sessionId\":\"d0dbd5\",\"hypothesisId\":\"" + hypothesisId
                    + "\",\"location\":\"" + location + "\",\"message\":\"" + message
                    + "\",\"data\":" + dataJson + ",\"timestamp\":" + System.currentTimeMillis() + "}";
            Files.writeString(DEBUG_LOG, line + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Exception ignored) {
            // debug-only
        }
    }
    // #endregion

    private static String jsonString(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                + "\"";
    }
}
