package com.outreach.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.common.ApiErrorCode;
import com.outreach.common.ApiResponse;
import com.outreach.common.RequestCorrelationFilter;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Reads the Bearer token from Authorization header, validates it, and sets
 * the user's UUID as the authentication principal in the SecurityContext.
 * Rejects suspended accounts immediately (login-only check is not enough —
 * existing JWTs remain valid until expiry otherwise).
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String MDC_USER_ID = "userId";

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            UUID userId = jwtService.extractUserId(token);
            if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                User user = userRepository.findById(userId).orElse(null);
                if (user != null && Boolean.TRUE.equals(user.getIsSuspended())) {
                    writeForbidden(response);
                    return;
                }
                MDC.put(MDC_USER_ID, userId.toString());
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(userId.toString(), null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_USER_ID);
        }
    }

    private void writeForbidden(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader(RequestCorrelationFilter.HEADER,
                MDC.get(RequestCorrelationFilter.MDC_KEY));
        response.getWriter().write(objectMapper.writeValueAsString(
                ApiResponse.error("Account suspended. Contact support.", ApiErrorCode.ACCOUNT_SUSPENDED)));
    }
}
