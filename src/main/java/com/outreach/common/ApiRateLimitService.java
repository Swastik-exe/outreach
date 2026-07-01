package com.outreach.common;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Redis sliding-window rate limiter for API endpoints.
 * Reads fail-open when Redis is unavailable; auth/AI/payment/upload fail-closed via in-memory fallback.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApiRateLimitService {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final int STRICT_FALLBACK_LIMIT = 30;

    /** Paths where limit breach returns 429 even if Redis is down. */
    private static final Set<String> STRICT_PREFIXES = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/subscription/checkout",
            "/api/v1/resume/upload",
            "/api/v1/inbound-email/webhook",
            "/api/v1/webhooks/razorpay"
    );

    private final StringRedisTemplate redis;
    private final ConcurrentHashMap<String, WindowCounter> strictFallback = new ConcurrentHashMap<>();

    /**
     * @return true if request is allowed; false if rate limit exceeded.
     */
    public boolean allow(String clientKey, String path, int limitPerMinute, boolean strict) {
        String key = "api:rl:" + clientKey + ":" + normalizePath(path);
        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1) {
                redis.expire(key, WINDOW);
            }
            return count == null || count <= limitPerMinute;
        } catch (Exception e) {
            log.warn("Redis unavailable for API rate limit ({}): {}", path, e.getMessage());
            if (strict || isStrictPath(path)) {
                return strictFallbackAllow(key, Math.min(limitPerMinute, STRICT_FALLBACK_LIMIT));
            }
            return true;
        }
    }

    private boolean strictFallbackAllow(String key, int limit) {
        long windowStart = System.currentTimeMillis() / WINDOW.toMillis();
        String bucketKey = key + ":" + windowStart;
        WindowCounter counter = strictFallback.computeIfAbsent(bucketKey, k -> new WindowCounter());
        if (counter.windowStart != windowStart) {
            counter.windowStart = windowStart;
            counter.count.set(0);
        }
        int n = counter.count.incrementAndGet();
        if (strictFallback.size() > 10_000) {
            strictFallback.clear();
        }
        return n <= limit;
    }

    public boolean isStrictPath(String path) {
        if (path == null) return false;
        if (STRICT_PREFIXES.stream().anyMatch(path::startsWith)) return true;
        return path.startsWith("/api/v1/career-score") && path.contains("refresh");
    }

    public int limitFor(String method, String path) {
        if (path.startsWith("/api/v1/resume")) return 10;
        if (path.contains("/career-score") && "POST".equalsIgnoreCase(method)) return 6;
        if (path.startsWith("/api/v1/subscription")) return 20;
        if (path.startsWith("/api/v1/admin")) return 60;
        if ("GET".equalsIgnoreCase(method)) return 120;
        return 60;
    }

    private static String normalizePath(String path) {
        return path.replaceAll(
                "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
                "{id}");
    }

    private static final class WindowCounter {
        volatile long windowStart;
        final AtomicInteger count = new AtomicInteger(0);
    }
}
