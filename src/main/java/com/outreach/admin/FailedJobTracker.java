package com.outreach.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Redis-backed counter for scheduled job failures — surfaced in admin stats.
 */
@Service
@RequiredArgsConstructor
public class FailedJobTracker {

    static final String REDIS_KEY = "admin:failed_jobs";

    private final StringRedisTemplate redis;

    public void recordFailure(String jobName) {
        try {
            redis.opsForValue().increment(REDIS_KEY);
            redis.opsForList().leftPush("admin:failed_jobs:log",
                    jobName + "@" + java.time.Instant.now());
            redis.opsForList().trim("admin:failed_jobs:log", 0, 99);
        } catch (Exception ignored) {
            // Redis down — don't break the job
        }
    }

    public long getCount() {
        try {
            String val = redis.opsForValue().get(REDIS_KEY);
            return val != null ? Long.parseLong(val) : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }
}
