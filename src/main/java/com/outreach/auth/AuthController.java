package com.outreach.auth;

import com.outreach.auth.dto.*;
import com.outreach.common.ApiResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Void>> register(@Valid @RequestBody RegisterRequest req) {
        authService.register(req);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@Valid @RequestBody VerifyEmailRequest req) {
        authService.verifyEmail(req.getToken());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    /**
     * One-click link from verification email — no frontend JS required.
     * Redirects to login on success, or back to verify page with token on failure.
     */
    @GetMapping("/verify-email")
    public void verifyEmailFromLink(
            @RequestParam(value = "token", required = false) String token,
            HttpServletResponse response) throws java.io.IOException {
        String base = normalizeFrontendUrl(frontendUrl);
        if (token == null || token.isBlank()) {
            response.sendRedirect(base + "/verify-email?error=1");
            return;
        }
        try {
            authService.verifyEmail(token);
            response.sendRedirect(base + "/login?verified=1");
        } catch (Exception e) {
            String encoded = URLEncoder.encode(token, StandardCharsets.UTF_8);
            response.sendRedirect(base + "/verify-email?token=" + encoded + "&error=1");
        }
    }

    /** Ensures redirect Location is a valid absolute URL (Render env may omit https://). */
    static String normalizeFrontendUrl(String url) {
        String base = url == null ? "" : url.strip().replaceAll("/$", "");
        if (base.isEmpty()) {
            return "http://localhost:3000";
        }
        if (!base.startsWith("http://") && !base.startsWith("https://")) {
            base = "https://" + base;
        }
        return base;
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<Void>> resendVerification(@Valid @RequestBody ResendVerificationRequest req) {
        authService.resendVerification(req.getEmail());
        // Always return the same message — never reveal email existence
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponse>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String ip = getClientIp(httpRequest);
        TokenResponse tokens = authService.login(req, ip, httpResponse);
        return ResponseEntity.ok(ApiResponse.ok(tokens));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String rawToken = extractRefreshCookie(httpRequest);
        TokenResponse tokens = authService.refresh(rawToken, httpResponse);
        return ResponseEntity.ok(ApiResponse.ok(tokens));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String rawToken = extractRefreshCookie(httpRequest);
        authService.logout(rawToken, httpResponse);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        authService.forgotPassword(req.getEmail());
        // Never reveal whether email is registered
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        authService.resetPassword(req.getToken(), req.getNewPassword());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String extractRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> "refresh_token".equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        return xff != null ? xff.split(",")[0].trim() : request.getRemoteAddr();
    }
}
