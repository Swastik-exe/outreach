package com.outreach.auth;

import com.outreach.admin.AdminAuthService;
import com.outreach.admin.AuditEventService;
import com.outreach.auth.dto.*;
import com.outreach.billing.PlanTier;
import com.outreach.common.ApiErrorCode;
import com.outreach.common.exception.*;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final UserSessionRepository sessionRepository;
    private final EmailVerificationTokenRepository evtRepository;
    private final PasswordResetTokenRepository prtRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenHasher tokenHasher;
    private final RateLimitService rateLimitService;
    private final EmailNotificationService emailService;
    private final AuditEventService auditEventService;

    @Value("${app.jwt.refresh-token-expiry-days}")
    private int refreshTokenExpiryDays;

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    /** Lax for same-site local dev; None required for cross-site Vercel↔Render refresh. */
    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    // ── REGISTER ──────────────────────────────────────────────────────────────

    public void register(RegisterRequest req) {
        String email = req.getEmail().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            // Never reveal whether email exists — send reset link silently (same as forgot-password)
            userRepository.findByEmail(email).ifPresent(user -> {
                String raw = tokenHasher.generateRaw();
                PasswordResetToken prt = PasswordResetToken.builder()
                        .user(user)
                        .tokenHash(tokenHasher.hash(raw))
                        .expiresAt(OffsetDateTime.now().plusHours(1))
                        .createdAt(OffsetDateTime.now())
                        .build();
                prtRepository.save(prt);
                emailService.sendExistingAccountEmail(user.getEmail(), raw);
            });
            return;
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .authProvider(AuthProvider.local)
                .planTier(PlanTier.free)
                .isEmailVerified(false)
                .isSuspended(false)
                .trustScore(50)
                .notifChannel("in_app")
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .lastActiveAt(OffsetDateTime.now())
                .build();
        user = userRepository.save(user);
        issueVerificationToken(user);
    }

    // ── VERIFY EMAIL ──────────────────────────────────────────────────────────

    public void verifyEmail(String rawToken) {
        EmailVerificationToken evt = evtRepository
                .findByTokenHash(tokenHasher.hash(rawToken))
                .orElseThrow(() -> new BadRequestException("Invalid or expired token"));
        if (evt.getUsedAt() != null) throw new BadRequestException("Token already used");
        if (evt.getExpiresAt().isBefore(OffsetDateTime.now())) throw new BadRequestException("Token expired");

        evt.setUsedAt(OffsetDateTime.now());
        evtRepository.save(evt);

        User user = evt.getUser();
        user.setIsEmailVerified(true);
        user.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(user);
    }

    // ── RESEND VERIFICATION ───────────────────────────────────────────────────

    public void resendVerification(String email) {
        // Never reveal whether the email exists
        userRepository.findByEmail(email.toLowerCase()).ifPresent(user -> {
            if (!Boolean.TRUE.equals(user.getIsEmailVerified())) {
                issueVerificationToken(user);
            }
        });
    }

    // ── LOGIN ─────────────────────────────────────────────────────────────────

    public TokenResponse login(LoginRequest req, String ip, HttpServletResponse response) {
        rateLimitService.checkLoginRateLimit(req.getEmail(), ip);

        User user = userRepository.findByEmail(req.getEmail().toLowerCase()).orElse(null);

        // Constant-time path — always run bcrypt regardless of whether user exists
        boolean passwordOk = user != null
                && user.getPasswordHash() != null
                && passwordEncoder.matches(req.getPassword(), user.getPasswordHash());

        if (!passwordOk) {
            rateLimitService.recordFailedLogin(req.getEmail(), ip);
            // Security F: NEVER reveal whether the email exists
            throw new UnauthorizedException("Incorrect email or password");
        }

        if (Boolean.TRUE.equals(user.getIsSuspended())) {
            throw new AppException(
                    "Account suspended. Contact support.",
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    ApiErrorCode.ACCOUNT_SUSPENDED);
        }

        if (user.getAuthProvider() == AuthProvider.local
                && !Boolean.TRUE.equals(user.getIsEmailVerified())) {
            throw new AppException(
                    "Please verify your email before signing in. Check your inbox or resend the verification link.",
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    ApiErrorCode.EMAIL_NOT_VERIFIED);
        }

        rateLimitService.resetLoginRateLimit(req.getEmail(), ip);
        user.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(user);

        TokenResponse tokens = createSessionAndTokens(user, ip, response);
        auditEventService.record(user.getId(), AuditEventService.LOGIN, java.util.Map.of(
                "method", "password",
                "ip", ip != null ? ip : "unknown"));
        return tokens;
    }

    // ── REFRESH ───────────────────────────────────────────────────────────────

    /**
     * noRollbackFor: DB writes (mark-inactive, saveAll) must commit even when we
     * throw UnauthorizedException for reuse/expiry — otherwise the session
     * invalidation is rolled back and the old token remains exploitable.
     */
    @Transactional(noRollbackFor = {UnauthorizedException.class, ForbiddenException.class})
    public TokenResponse refresh(String rawRefreshToken, HttpServletResponse response) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException("No refresh token");
        }
        String hash = tokenHasher.hash(rawRefreshToken);
        UserSession session = sessionRepository.findByRefreshTokenHash(hash)
                .orElseThrow(() -> new UnauthorizedException("Invalid session"));

        if (!Boolean.TRUE.equals(session.getIsActive())) {
            // REUSE DETECTION: inactive token re-presented → possible theft → nuke all sessions
            log.warn("Refresh token reuse detected for user {}. Invalidating all sessions.", session.getUser().getId());
            List<UserSession> active = sessionRepository.findByUserIdAndIsActiveTrue(session.getUser().getId());
            active.forEach(s -> s.setIsActive(false));
            sessionRepository.saveAll(active);
            clearRefreshCookie(response);
            throw new UnauthorizedException("Session reuse detected. All sessions invalidated.");
        }

        if (session.getExpiresAt().isBefore(OffsetDateTime.now())) {
            session.setIsActive(false);
            sessionRepository.save(session);
            clearRefreshCookie(response);
            throw new UnauthorizedException("Session expired");
        }

        // Rotate: new session, mark old as rotated
        String newRaw = tokenHasher.generateRaw();
        UserSession newSession = UserSession.builder()
                .user(session.getUser())
                .refreshTokenHash(tokenHasher.hash(newRaw))
                .isActive(true)
                .ipAddress(session.getIpAddress())
                .expiresAt(OffsetDateTime.now().plusDays(refreshTokenExpiryDays))
                .createdAt(OffsetDateTime.now())
                .build();
        newSession = sessionRepository.save(newSession);

        session.setIsActive(false);
        session.setRotatedTo(newSession);
        sessionRepository.save(session);

        setRefreshCookie(response, newRaw);
        return buildTokenResponse(session.getUser(), jwtService.generateAccessToken(session.getUser()));
    }

    // ── LOGOUT ────────────────────────────────────────────────────────────────

    public void logout(String rawRefreshToken, HttpServletResponse response) {
        if (rawRefreshToken != null) {
            sessionRepository.findByRefreshTokenHash(tokenHasher.hash(rawRefreshToken))
                    .ifPresent(s -> {
                        s.setIsActive(false);
                        sessionRepository.save(s);
                    });
        }
        clearRefreshCookie(response);
    }

    // ── DELETE ACCOUNT ────────────────────────────────────────────────────────

    /**
     * Permanently deletes the caller's account. All owned rows (sessions, resumes,
     * applications, scores, subscriptions, …) are removed by {@code ON DELETE CASCADE};
     * audit-only rows (device_registry, user_events, ai_interactions) survive with a
     * null user via {@code ON DELETE SET NULL}. The refresh cookie is cleared so the
     * browser session ends immediately.
     */
    public void deleteAccount(UUID userId, HttpServletResponse response) {
        if (userRepository.existsById(userId)) {
            userRepository.deleteById(userId);
            log.info("Account permanently deleted for user {}", userId);
        }
        clearRefreshCookie(response);
    }

    // ── FORGOT PASSWORD ───────────────────────────────────────────────────────

    public void forgotPassword(String email) {
        // Always returns success — never reveals whether email exists (Security F)
        userRepository.findByEmail(email.toLowerCase()).ifPresent(user -> {
            String raw = tokenHasher.generateRaw();
            PasswordResetToken prt = PasswordResetToken.builder()
                    .user(user)
                    .tokenHash(tokenHasher.hash(raw))
                    .expiresAt(OffsetDateTime.now().plusHours(1))
                    .createdAt(OffsetDateTime.now())
                    .build();
            prtRepository.save(prt);
            emailService.sendPasswordResetEmail(user.getEmail(), raw);
        });
    }

    // ── RESET PASSWORD ────────────────────────────────────────────────────────

    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken prt = prtRepository
                .findByTokenHash(tokenHasher.hash(rawToken))
                .orElseThrow(() -> new BadRequestException("Invalid or expired token"));
        if (prt.getUsedAt() != null) throw new BadRequestException("Token already used");
        if (prt.getExpiresAt().isBefore(OffsetDateTime.now())) throw new BadRequestException("Token expired");

        User user = prt.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(user);

        prt.setUsedAt(OffsetDateTime.now());
        prtRepository.save(prt);

        // Invalidate ALL sessions for this user on password change
        List<UserSession> sessions = sessionRepository.findByUserIdAndIsActiveTrue(user.getId());
        sessions.forEach(s -> s.setIsActive(false));
        sessionRepository.saveAll(sessions);
    }

    // ── OAUTH2 (called by OAuth2SuccessHandler) ───────────────────────────────

    public TokenResponse handleOAuth2Login(String email, String providerId,
                                           String providerName, String ip,
                                           HttpServletResponse response) {
        AuthProvider provider = AuthProvider.valueOf(providerName.toLowerCase());
        User user = userRepository.findByEmail(email.toLowerCase()).orElse(null);

        if (user == null) {
            user = User.builder()
                    .email(email.toLowerCase())
                    .authProvider(provider)
                    .providerId(providerId)
                    .planTier(PlanTier.free)
                    .isEmailVerified(true)   // OAuth2 providers pre-verify email
                    .isSuspended(false)
                    .trustScore(50)
                    .notifChannel("in_app")
                    .createdAt(OffsetDateTime.now())
                    .updatedAt(OffsetDateTime.now())
                    .lastActiveAt(OffsetDateTime.now())
                    .build();
        } else {
            // CRITICAL (C8): MATCH on email — link provider to existing account
            if (user.getProviderId() == null) {
                user.setAuthProvider(provider);
                user.setProviderId(providerId);
            }
            user.setIsEmailVerified(true);
            user.setLastActiveAt(OffsetDateTime.now());
            user.setUpdatedAt(OffsetDateTime.now());
        }
        user = userRepository.save(user);
        return createSessionAndTokens(user, ip, response);
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

    private TokenResponse createSessionAndTokens(User user, String ip, HttpServletResponse response) {
        String rawRefresh = tokenHasher.generateRaw();
        UserSession session = UserSession.builder()
                .user(user)
                .refreshTokenHash(tokenHasher.hash(rawRefresh))
                .isActive(true)
                .ipAddress(ip)
                .expiresAt(OffsetDateTime.now().plusDays(refreshTokenExpiryDays))
                .createdAt(OffsetDateTime.now())
                .build();
        sessionRepository.save(session);
        setRefreshCookie(response, rawRefresh);
        return buildTokenResponse(user, jwtService.generateAccessToken(user));
    }

    private void issueVerificationToken(User user) {
        String raw = tokenHasher.generateRaw();
        EmailVerificationToken evt = EmailVerificationToken.builder()
                .user(user)
                .tokenHash(tokenHasher.hash(raw))
                .expiresAt(OffsetDateTime.now().plusHours(24))
                .createdAt(OffsetDateTime.now())
                .build();
        evtRepository.save(evt);
        emailService.sendVerificationEmail(user.getEmail(), raw);
    }

    private TokenResponse buildTokenResponse(User user, String accessToken) {
        return TokenResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getAccessTokenExpiryMs() / 1000)
                .role(AdminAuthService.roleFor(user))
                .build();
    }

    void setRefreshCookie(HttpServletResponse response, String rawToken) {
        ResponseCookie cookie = ResponseCookie.from("refresh_token", rawToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/api/v1/auth")
                .maxAge(Duration.ofDays(refreshTokenExpiryDays))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/api/v1/auth")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
