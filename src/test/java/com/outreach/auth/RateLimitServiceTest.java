package com.outreach.auth;

import com.outreach.common.exception.TooManyRequestsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateLimitServiceTest {

    @Mock
    private StringRedisTemplate redis;
    @Mock
    private ValueOperations<String, String> valueOps;

    private RateLimitService service;

    @BeforeEach
    void setUp() {
        service = new RateLimitService(redis);
    }

    @Test
    void checkLoginRateLimit_failsOpenWhenRedisDown() {
        when(redis.opsForValue()).thenThrow(new RedisConnectionFailureException("Connection refused"));
        assertDoesNotThrow(() -> service.checkLoginRateLimit("user@example.com", "127.0.0.1"));
    }

    @Test
    void checkLoginRateLimit_stillEnforcesWhenRedisUp() {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenReturn("5");
        assertThrows(TooManyRequestsException.class,
                () -> service.checkLoginRateLimit("user@example.com", "127.0.0.1"));
    }

    @Test
    void recordFailedLogin_skipsWhenRedisDown() {
        when(redis.opsForValue()).thenThrow(new RedisConnectionFailureException("down"));
        assertDoesNotThrow(() -> service.recordFailedLogin("user@example.com", "127.0.0.1"));
    }
}
