package com.outreach.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Dev profile only: allow unauthenticated access to /api/v1/dev/** so verification
 * scripts can trigger jobs with the webhook secret header.
 * In prod this bean is absent — DevJobController is also absent.
 */
@Configuration
@Profile("dev")
public class DevSecurityConfig {

    @Bean
    @Order(0)
    public SecurityFilterChain devJobFilterChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/api/v1/dev/**")
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
