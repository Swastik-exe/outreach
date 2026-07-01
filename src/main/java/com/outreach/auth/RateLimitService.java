package com.outreach.auth;

import com.outreach.common.exception.TooManyRequestsException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Redis-based login lockout.
 * Key: login:fail:{email}:{ip} — TTL 15 min.
 * After 5 failures the same key triggers a 429 until TTL expires.
 * If Redis is unavailable, degrades open (login still works).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimitService {

    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    private static final String KEY_PREFIX = "login:fail:";

    private final StringRedisTemplate redis;

    public void checkLoginRateLimit(String email, String ip) {
        try {
            String key = key(email, ip);
            String value = redis.opsForValue().get(key);
            if (value != null && Integer.parseInt(value) >= MAX_FAILURES) {
                throw new TooManyRequestsException("Too many failed attempts. Try again in 15 minutes.");
            }
        } catch (TooManyRequestsException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis unavailable for login rate-limit check — failing open: {}", e.getMessage());
        }
    }

    public void recordFailedLogin(String email, String ip) {
        try {
            String key = key(email, ip);
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1) {
                redis.expire(key, LOCK_DURATION);
            }
            log.debug("Login fail #{} for key {}", count, key);
        } catch (Exception e) {
            log.warn("Redis unavailable for login fail counter — skipping: {}", e.getMessage());
        }
    }

    public void resetLoginRateLimit(String email, String ip) {
        try {
            redis.delete(key(email, ip));
        } catch (Exception e) {
            log.warn("Redis unavailable for rate-limit reset — skipping: {}", e.getMessage());
        }
    }

    private String key(String email, String ip) {
        return KEY_PREFIX + email.toLowerCase() + ":" + ip;
    }
}
