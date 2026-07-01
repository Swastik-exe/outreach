package com.outreach.auth;

import com.outreach.auth.dto.LoginRequest;
import com.outreach.auth.dto.RegisterRequest;
import com.outreach.billing.PlanTier;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceRedisDownTest {

    @Mock private UserRepository userRepository;
    @Mock private UserSessionRepository sessionRepository;
    @Mock private EmailVerificationTokenRepository evtRepository;
    @Mock private PasswordResetTokenRepository prtRepository;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private TokenHasher tokenHasher;
    @Mock private RateLimitService rateLimitService;
    @Mock private EmailNotificationService emailService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository, sessionRepository, evtRepository, prtRepository,
                passwordEncoder, jwtService, tokenHasher, rateLimitService, emailService);
        ReflectionTestUtils.setField(authService, "refreshTokenExpiryDays", 7);
        ReflectionTestUtils.setField(authService, "cookieSecure", false);
    }

    @Test
    void login_succeedsWhenRateLimitDegraded() {
        doNothing().when(rateLimitService).checkLoginRateLimit(anyString(), anyString());
        doNothing().when(rateLimitService).resetLoginRateLimit(anyString(), anyString());

        User user = User.builder()
                .email("test@example.com")
                .passwordHash("hash")
                .planTier(PlanTier.free)
                .isSuspended(false)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("Secret123!", "hash")).thenReturn(true);
        when(tokenHasher.generateRaw()).thenReturn("raw-refresh");
        when(tokenHasher.hash("raw-refresh")).thenReturn("hashed");
        when(jwtService.generateAccessToken(user)).thenReturn("access-token");
        when(jwtService.getAccessTokenExpiryMs()).thenReturn(900_000L);

        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("test@example.com");
        loginReq.setPassword("Secret123!");
        var response = authService.login(
                loginReq,
                "127.0.0.1",
                mock(jakarta.servlet.http.HttpServletResponse.class));

        assertEquals("access-token", response.getAccessToken());
        verify(rateLimitService).checkLoginRateLimit("test@example.com", "127.0.0.1");
    }

    @Test
    void register_existingEmailReturnsSilentlyWithoutConflict() {
        when(userRepository.existsByEmail("exists@example.com")).thenReturn(true);
        User existing = User.builder().email("exists@example.com").build();
        when(userRepository.findByEmail("exists@example.com")).thenReturn(Optional.of(existing));
        when(tokenHasher.generateRaw()).thenReturn("reset-raw");
        when(tokenHasher.hash("reset-raw")).thenReturn("reset-hash");

        RegisterRequest req = new RegisterRequest();
        req.setEmail("exists@example.com");
        req.setPassword("NewPass123!");
        assertDoesNotThrow(() -> authService.register(req));

        verify(userRepository, never()).save(any());
        verify(emailService).sendExistingAccountEmail("exists@example.com", "reset-raw");
    }

    @Test
    void register_newEmailCreatesUser() {
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(tokenHasher.generateRaw()).thenReturn("verify-raw");
        when(tokenHasher.hash("verify-raw")).thenReturn("verify-hash");

        RegisterRequest req = new RegisterRequest();
        req.setEmail("new@example.com");
        req.setPassword("Pass123!");
        authService.register(req);

        verify(userRepository).save(any(User.class));
        verify(emailService).sendVerificationEmail(eq("new@example.com"), eq("verify-raw"));
        verify(emailService, never()).sendExistingAccountEmail(anyString(), anyString());
    }
}
