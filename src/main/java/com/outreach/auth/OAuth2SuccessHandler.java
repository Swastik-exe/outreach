package com.outreach.auth;

import com.outreach.auth.dto.TokenResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

/**
 * After Spring Security completes the OAuth2 code exchange and user-info call:
 * 1. Extracts email + provider info from OAuth2User attributes.
 * 2. Delegates to AuthService to find-or-create the user (email-first matching C8).
 * 3. Issues JWT tokens (access in redirect fragment, refresh in HttpOnly cookie).
 * 4. Redirects to the frontend callback URL.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;

    @Value("${app.oauth2.success-redirect}")
    private String successRedirectUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User principal = oauthToken.getPrincipal();
        String provider = oauthToken.getAuthorizedClientRegistrationId(); // "google" | "github"

        String email = extractEmail(principal, provider);
        String providerId = extractProviderId(principal, provider);

        if (email == null) {
            log.error("OAuth2 login: could not extract email from provider={}", provider);
            response.sendRedirect(successRedirectUrl + "?error=email_missing");
            return;
        }

        String ip = request.getRemoteAddr();
        TokenResponse tokens = authService.handleOAuth2Login(email, providerId, provider, ip, response);

        // Access token in URL fragment (not logged by servers); refresh in HttpOnly cookie (already set)
        String redirectUrl = UriComponentsBuilder.fromUriString(successRedirectUrl)
                .fragment("access_token=" + tokens.getAccessToken())
                .build().toUriString();

        clearAuthenticationAttributes(request);
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    private String extractEmail(OAuth2User user, String provider) {
        if ("github".equals(provider)) {
            // GitHub may return email separately; the scope "user:email" provides it
            Object email = user.getAttribute("email");
            return email != null ? email.toString() : null;
        }
        Object email = user.getAttribute("email");
        return email != null ? email.toString() : null;
    }

    private String extractProviderId(OAuth2User user, String provider) {
        Object sub = user.getAttribute("sub");           // Google
        if (sub != null) return sub.toString();
        Object id = user.getAttribute("id");             // GitHub
        return id != null ? id.toString() : null;
    }
}
