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
import java.time.Duration;

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

    private final String apiKey;
    private final String fromAddress;
    private final String frontendUrl;
    private final String publicApiUrl;
    private final HttpClient http;
    private final EmailDeliveryExecutor deliveryExecutor;

    public EmailNotificationService(
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from:noreply@outreachos.com}") String fromAddress,
            @Value("${app.frontend-url:http://localhost:3000}") String frontendUrl,
            @Value("${app.public-api-url:http://localhost:8080}") String publicApiUrl,
            EmailDeliveryExecutor deliveryExecutor) {
        this.apiKey = apiKey;
        this.fromAddress = fromAddress;
        this.frontendUrl = frontendUrl;
        this.publicApiUrl = publicApiUrl.strip().replaceAll("/$", "");
        this.deliveryExecutor = deliveryExecutor;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public void sendVerificationEmail(String email, String rawToken) {
        String link = publicApiUrl + "/api/v1/auth/verify-email?token=" + rawToken;
        String html = """
                <p>Welcome to Outreach!</p>
                <p>Click the link below to verify your email (valid 24 hours):</p>
                <p><a href="%s">Verify Email</a></p>
                <p>If you did not register, ignore this email.</p>
                """.formatted(link);
        scheduleDelivery(() -> send(email, "Verify your Outreach email", html,
                "VERIFY TOKEN " + rawToken));
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
                "RESET TOKEN " + rawToken));
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
                "EXISTING ACCOUNT RESET " + rawToken));
    }

    public void sendResendVerificationEmail(String email, String rawToken) {
        sendVerificationEmail(email, rawToken);
    }

    public void sendEmail(String to, String subject, String htmlBody) {
        scheduleDelivery(() -> send(to, subject, htmlBody,
                "EMAIL subject=" + subject + " to=" + to));
    }

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
                    .timeout(Duration.ofSeconds(10))
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
