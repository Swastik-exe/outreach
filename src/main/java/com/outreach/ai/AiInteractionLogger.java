package com.outreach.ai;

import com.outreach.ai.provider.AiResponse;
import com.outreach.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Persists every AI call to ai_interactions.  Runs asynchronously on freePool
 * so it never blocks the request thread.  cost_usd is computed from a hardcoded
 * pricing map (updated when models change; no DB pricing table needed at this stage).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiInteractionLogger {

    private final AiInteractionRepository repo;

    /**
     * Per-model pricing: [input_per_1k, output_per_1k] in USD.
     * Kept as a constant map; replace with DB lookup once billing goes live.
     */
    private static final Map<String, double[]> PRICING = Map.of(
            // Keep the retired model key so historical rows still cost correctly.
            "gemini-1.5-flash",     new double[]{0.000075, 0.000300},
            "gemini-2.5-flash",     new double[]{0.000075, 0.000300},
            "llama-3.1-8b-instant", new double[]{0.000050, 0.000080},
            "rule_engine_v1",       new double[]{0.0, 0.0}
    );

    @Async("freePool")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(UUID userId, String taskType, AiResponse response,
                    long latencyMs, boolean success) {
        try {
            BigDecimal cost = computeCost(response.model(),
                    response.inputTokens(), response.outputTokens());

            User userRef = userId != null ? new User() : null;
            if (userRef != null) userRef.setId(userId);

            AiInteraction record = AiInteraction.builder()
                    .user(userRef)
                    .taskType(taskType)
                    .provider(response.provider())
                    .model(response.model())
                    .inputTokens(response.inputTokens())
                    .outputTokens(response.outputTokens())
                    .costUsd(cost)
                    .latencyMs((int) latencyMs)
                    .cacheHit(false)
                    .success(success)
                    .createdAt(OffsetDateTime.now())
                    .build();
            repo.save(record);
        } catch (Exception e) {
            log.error("Failed to log AI interaction: {}", e.getMessage(), e);
        }
    }

    private BigDecimal computeCost(String model, int inputTokens, int outputTokens) {
        double[] rates = PRICING.getOrDefault(model, new double[]{0.0, 0.0});
        double cost = (inputTokens / 1000.0) * rates[0] + (outputTokens / 1000.0) * rates[1];
        return BigDecimal.valueOf(cost).setScale(6, RoundingMode.HALF_UP);
    }
}
