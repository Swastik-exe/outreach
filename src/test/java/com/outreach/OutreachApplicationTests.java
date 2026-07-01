package com.outreach;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Full-context smoke test against local docker-compose Postgres + Redis.
 * CI with Docker-in-Docker can set DATABASE_URL / REDIS_* from Testcontainers instead.
 */
@SpringBootTest
@ActiveProfiles("test")
class OutreachApplicationTests {

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("DATABASE_URL", () -> env("DATABASE_URL", "jdbc:postgresql://localhost:5432/outreach"));
        registry.add("DATABASE_USERNAME", () -> env("DATABASE_USERNAME", "outreach"));
        registry.add("DATABASE_PASSWORD", () -> env("DATABASE_PASSWORD", "outreach"));
        registry.add("REDIS_HOST", () -> env("REDIS_HOST", "localhost"));
        registry.add("REDIS_PORT", () -> env("REDIS_PORT", "6379"));
        registry.add("JWT_SECRET", () -> env("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-chars-long"));
        registry.add("FRONTEND_URL", () -> env("FRONTEND_URL", "http://localhost:3000"));
        registry.add("INBOUND_WEBHOOK_SECRET", () -> env("INBOUND_WEBHOOK_SECRET", "test-webhook-secret"));
    }

    private static String env(String key, String defaultVal) {
        String value = System.getenv(key);
        return (value != null && !value.isBlank()) ? value : defaultVal;
    }

    @Test
    void contextLoads() {
    }
}
