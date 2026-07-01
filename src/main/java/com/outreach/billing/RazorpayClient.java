package com.outreach.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

/**
 * Minimal Razorpay REST client (Orders + Subscriptions).
 * Returns sandbox mock IDs when {@link RazorpayConfig#isSandbox()} is true.
 */
@Slf4j
@Component
public class RazorpayClient {

    private static final String BASE = "https://api.razorpay.com/v1";

    private final RazorpayConfig config;
    private final PlanConfig planConfig;
    private final ObjectMapper mapper;
    private final HttpClient http;

    public RazorpayClient(RazorpayConfig config, PlanConfig planConfig, ObjectMapper mapper) {
        this.config = config;
        this.planConfig = planConfig;
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    }

    /** Creates a one-time order for Season Pass. */
    public String createOrder(int amountPaise, String receipt) throws Exception {
        if (config.isSandbox()) {
            String id = "order_sandbox_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
            log.info("SANDBOX: mock Razorpay order {}", id);
            return id;
        }
        String body = """
                {"amount":%d,"currency":"INR","receipt":"%s","payment_capture":1}
                """.formatted(amountPaise, receipt);
        JsonNode resp = post("/orders", body);
        return resp.path("id").asText();
    }

    /** Creates a recurring Razorpay subscription. */
    public String createSubscription(String razorpayPlanId, int totalCount) throws Exception {
        if (config.isSandbox()) {
            String id = "sub_sandbox_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
            log.info("SANDBOX: mock Razorpay subscription {}", id);
            return id;
        }
        if (razorpayPlanId == null || razorpayPlanId.isBlank()) {
            throw new IllegalStateException(
                    "Razorpay plan id not configured. Set RAZORPAY_PLAN_ID_MONTHLY or RAZORPAY_PLAN_ID_ANNUAL.");
        }
        String body = """
                {"plan_id":"%s","total_count":%d,"customer_notify":1}
                """.formatted(razorpayPlanId, totalCount);
        JsonNode resp = post("/subscriptions", body);
        return resp.path("id").asText();
    }

    private JsonNode post(String path, String jsonBody) throws Exception {
        String auth = Base64.getEncoder().encodeToString(
                (config.getKeyId() + ":" + config.getKeySecret()).getBytes(StandardCharsets.UTF_8));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(BASE + path))
                .header("Authorization", "Basic " + auth)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .timeout(Duration.ofSeconds(20))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new RuntimeException("Razorpay API " + path + " returned " + resp.statusCode()
                    + ": " + resp.body());
        }
        return mapper.readTree(resp.body());
    }
}
