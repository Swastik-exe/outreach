package com.outreach.ai.provider;

import com.outreach.ai.TokenBudgetService;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Routes an AI request through providers in priority order:
 *   Gemini → Groq → RuleBasedEngine (never fails).
 *
 * Circuit-breaker behaviour:
 *   - {@link ProviderFailureException} (network/5xx) is recorded → can trip the CB.
 *   - {@link SchemaValidationException} (bad JSON) is ignored by CB config, so it does
 *     NOT trip the breaker; the router falls through to the next provider immediately.
 */
@Slf4j
@Service
public class AiRouter {

    private final GeminiProvider gemini;
    private final GroqProvider groq;
    private final RuleBasedEngine ruleBased;
    private final TokenBudgetService budget;
    private final CircuitBreaker geminiCb;
    private final CircuitBreaker groqCb;

    public AiRouter(GeminiProvider gemini,
                    GroqProvider groq,
                    RuleBasedEngine ruleBased,
                    TokenBudgetService budget,
                    CircuitBreakerRegistry cbRegistry) {
        this.gemini    = gemini;
        this.groq      = groq;
        this.ruleBased = ruleBased;
        this.budget    = budget;
        this.geminiCb  = cbRegistry.circuitBreaker("gemini");
        this.groqCb    = cbRegistry.circuitBreaker("groq");
    }

    public AiResponse analyze(AiRequest request) {
        // --- Gemini ---
        if (gemini.isEnabled() && !budget.isExhausted("gemini")) {
            try {
                AiResponse resp = geminiCb.executeSupplier(() -> gemini.analyze(request));
                budget.consume("gemini", resp.inputTokens() + resp.outputTokens());
                return resp;
            } catch (CallNotPermittedException e) {
                log.info("Gemini CB open, skipping");
            } catch (SchemaValidationException e) {
                // CB did not trip; fall through to next provider
                log.warn("Gemini returned invalid schema, falling back: {}", e.getMessage());
            } catch (Exception e) {
                log.warn("Gemini failed (CB recorded): {}", e.getMessage());
            }
        } else if (gemini.isEnabled() && budget.isExhausted("gemini")) {
            log.info("Gemini daily token budget exhausted, skipping");
        }

        // --- Groq ---
        if (groq.isEnabled() && !budget.isExhausted("groq")) {
            try {
                AiResponse resp = groqCb.executeSupplier(() -> groq.analyze(request));
                budget.consume("groq", resp.inputTokens() + resp.outputTokens());
                return resp;
            } catch (CallNotPermittedException e) {
                log.info("Groq CB open, skipping");
            } catch (SchemaValidationException e) {
                log.warn("Groq returned invalid schema, falling back: {}", e.getMessage());
            } catch (Exception e) {
                log.warn("Groq failed (CB recorded): {}", e.getMessage());
            }
        } else if (groq.isEnabled() && budget.isExhausted("groq")) {
            log.info("Groq daily token budget exhausted, skipping");
        }

        // --- Rule-based (never fails) ---
        log.debug("Using rule-based engine for task={}", request.taskType());
        return ruleBased.analyze(request);
    }
}
