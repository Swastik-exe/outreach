package com.outreach.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Real email delivery via Resend (https://resend.com).
 *
 * Graceful degradation: if RESEND_API_KEY is blank or the send fails,
 * the email body is logged (same grep-friendly format as the old stub)
 * so local dev still works without an API key.
 */
@Slf4j
@Service
public class EmailNotificationService {

    private static final String RESEND_URL = "https://api.resend.com/emails";

    private final String apiKey;
    private final String fromAddress;
    private final String frontendUrl;
    private final HttpClient http;

    public EmailNotificationService(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from:noreply@outreachos.com}") String fromAddress,
            @Value("${app.frontend-url:http://localhost:3000}") String frontendUrl) {
        this.apiKey      = apiKey;
        this.fromAddress = fromAddress;
        this.frontendUrl = frontendUrl;
        this.http        = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    // ── Auth emails (called by AuthService) ──────────────────────────────────

    public void sendVerificationEmail(String email, String rawToken) {
        String link = frontendUrl + "/verify-email?token=" + rawToken;
        String html = """
                <p>Welcome to Outreach!</p>
                <p>Click the link below to verify your email (valid 24 hours):</p>
                <p><a href="%s">Verify Email</a></p>
                <p>If you did not register, ignore this email.</p>
                """.formatted(link);
        send(email, "Verify your Outreach email", html,
                "VERIFY TOKEN " + rawToken);  // fallback log marker
    }

    public void sendPasswordResetEmail(String email, String rawToken) {
        String link = frontendUrl + "/reset-password?token=" + rawToken;
        String html = """
                <p>You requested a password reset for your Outreach account.</p>
                <p>Click the link below to reset your password (valid 1 hour):</p>
                <p><a href="%s">Reset Password</a></p>
                <p>If you did not request this, ignore this email.</p>
                """.formatted(link);
        send(email, "Reset your Outreach password", html,
                "RESET TOKEN " + rawToken);
    }

    /** Sent when someone tries to register with an email that already exists (no API leak). */
    public void sendExistingAccountEmail(String email, String rawToken) {
        String link = frontendUrl + "/reset-password?token=" + rawToken;
        String html = """
                <p>Someone tried to create a new Outreach account with this email address.</p>
                <p>You already have an account. Use the link below to sign in or reset your password (valid 1 hour):</p>
                <p><a href="%s">Access your account</a></p>
                <p>If this wasn't you, ignore this email.</p>
                """.formatted(link);
        send(email, "Your Outreach account already exists", html,
                "EXISTING ACCOUNT RESET " + rawToken);
    }

    public void sendResendVerificationEmail(String email, String rawToken) {
        sendVerificationEmail(email, rawToken);   // same email, same token format
    }

    // ── Generic transactional email (used by NotificationService) ────────────

    /**
     * Send an arbitrary HTML email.  Falls back to logging if API key absent.
     */
    public void sendEmail(String to, String subject, String htmlBody) {
        send(to, subject, htmlBody, "EMAIL subject=" + subject + " to=" + to);
    }

    // ── Core delivery ─────────────────────────────────────────────────────────

    private void send(String to, String subject, String htmlBody, String logMarker) {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("=== EMAIL (no RESEND_API_KEY — log only): to={} {} ===", to, logMarker);
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
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                log.info("Email sent via Resend to={} subject={}", to, subject);
            } else {
                log.warn("Resend returned status={} body={} — falling back to log", resp.statusCode(), resp.body());
                log.info("=== EMAIL (Resend error): to={} {} ===", to, logMarker);
            }
        } catch (Exception e) {
            log.warn("Resend call failed ({}), logging email content instead", e.getMessage());
            log.info("=== EMAIL (send failed): to={} {} ===", to, logMarker);
        }
    }

    /** Wraps a string in a JSON string literal with proper escaping. */
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
