package com.outreach.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Redis-based daily token-budget enforcement per AI provider.
 * Key format: ai:budget:{provider}:{YYYY-MM-DD}  (IST date, TTL until midnight+1h).
 * If Redis is down, budget checks fail open (providers remain usable).
 */
@Slf4j
@Service
public class TokenBudgetService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final StringRedisTemplate redis;
    private final long geminiBudget;
    private final long groqBudget;

    public TokenBudgetService(
            StringRedisTemplate redis,
            @Value("${app.ai.daily-token-budget.gemini:100000}") long geminiBudget,
            @Value("${app.ai.daily-token-budget.groq:50000}") long groqBudget
    ) {
        this.redis = redis;
        this.geminiBudget = geminiBudget;
        this.groqBudget = groqBudget;
    }

    public boolean isExhausted(String provider) {
        try {
            String key = redisKey(provider);
            String val = redis.opsForValue().get(key);
            if (val == null) return false;
            long used = Long.parseLong(val);
            return used >= budget(provider);
        } catch (Exception e) {
            log.warn("Redis unavailable for token budget check ({} — failing open): {}", provider, e.getMessage());
            return false;
        }
    }

    /** Increment usage; call AFTER a successful provider response. */
    public void consume(String provider, int tokens) {
        if (tokens <= 0) return;
        try {
            String key = redisKey(provider);
            Long newVal = redis.opsForValue().increment(key, tokens);
            if (newVal != null && newVal <= tokens) {
                redis.expire(key, ttlUntilTomorrow());
            }
            if (newVal != null && newVal >= budget(provider)) {
                log.warn("Daily token budget for {} exhausted ({} >= {})", provider, newVal, budget(provider));
            }
        } catch (Exception e) {
            log.warn("Redis unavailable for token budget consume ({}): {}", provider, e.getMessage());
        }
    }

    private String redisKey(String provider) {
        String date = LocalDate.now(IST).toString();
        return "ai:budget:" + provider + ":" + date;
    }

    private long budget(String provider) {
        return switch (provider) {
            case "gemini" -> geminiBudget;
            case "groq"   -> groqBudget;
            default -> 10_000L;
        };
    }

    private Duration ttlUntilTomorrow() {
        ZonedDateTime nowIst = ZonedDateTime.now(IST);
        ZonedDateTime midnightIst = nowIst.toLocalDate().plusDays(1)
                .atStartOfDay(IST).plusHours(1);
        return Duration.between(nowIst, midnightIst);
    }
}
