package com.outreach.config;

import com.outreach.auth.HttpCookieOAuth2AuthorizationRequestRepository;
import com.outreach.auth.JwtAuthFilter;
import com.outreach.auth.OAuth2SuccessHandler;
import com.outreach.auth.OAuth2UserServiceImpl;
import com.outreach.auth.UserDetailsServiceImpl;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final OAuth2UserServiceImpl oAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final HttpCookieOAuth2AuthorizationRequestRepository cookieRepo;
    private final UserDetailsServiceImpl userDetailsService;
    private final Environment environment;

    /** Public API paths. Dev-only routes (/api/v1/dev/**) are NOT listed — gated by @Profile("dev"). */
    private static final String[] BASE_PUBLIC_PATHS = {
            "/api/v1/auth/**",
            "/api/v1/health",
            "/api/v1/meta/**",
            "/actuator/health",
            "/actuator/health/**",
            "/api/v1/inbound-email/webhook",
            "/api/v1/webhooks/razorpay",
            "/api/v1/subscription/pricing",
            "/login/oauth2/**",
            "/oauth2/**"
    };

    private static final String[] DEV_ONLY_PUBLIC_PATHS = {
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/api-docs/**",
    };

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        boolean isProd = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        String[] publicPaths = isProd
                ? BASE_PUBLIC_PATHS
                : concat(BASE_PUBLIC_PATHS, DEV_ONLY_PUBLIC_PATHS);

        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {})
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .headers(headers -> headers
                    .frameOptions(HeadersConfigurer.FrameOptionsConfig::deny)
                    .contentTypeOptions(with -> {})
                    .httpStrictTransportSecurity(hsts -> hsts
                            .includeSubDomains(true)
                            .maxAgeInSeconds(31_536_000))
                    .addHeaderWriter(new StaticHeadersWriter("Strict-Transport-Security",
                            "max-age=31536000; includeSubDomains"))
                    .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy",
                            "camera=(), microphone=(), geolocation=()"))
                    .contentSecurityPolicy(csp -> csp
                            .policyDirectives("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
                    .referrerPolicy(rp -> rp.policy(
                            ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)))
            .exceptionHandling(ex -> ex
                    .authenticationEntryPoint((request, response, authException) -> {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
                        response.getWriter().write(
                                "{\"success\":false,\"error\":\"Unauthorized - valid Bearer token required\","
                                + "\"errorCode\":\"UNAUTHORIZED\","
                                + "\"meta\":{\"timestamp\":\"" + java.time.Instant.now() + "\"}}");
                    }))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers(publicPaths).permitAll()
                    .anyRequest().authenticated())
            .oauth2Login(oauth2 -> oauth2
                    .authorizationEndpoint(ep -> ep
                            .authorizationRequestRepository(cookieRepo))
                    .userInfoEndpoint(ui -> ui.userService(oAuth2UserService))
                    .successHandler(oAuth2SuccessHandler))
            .userDetailsService(userDetailsService)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private static String[] concat(String[] a, String[] b) {
        List<String> all = new ArrayList<>(a.length + b.length);
        all.addAll(Arrays.asList(a));
        all.addAll(Arrays.asList(b));
        return all.toArray(new String[0]);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}

