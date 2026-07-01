package com.outreach.common;

import com.outreach.common.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/** Extracts the authenticated user's UUID from the SecurityContext (set by JwtAuthFilter). */
public final class CurrentUser {

    private CurrentUser() {}

    public static UUID getUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() == null) {
            throw new UnauthorizedException("Not authenticated");
        }
        try {
            return UUID.fromString(auth.getName());
        } catch (IllegalArgumentException e) {
            throw new UnauthorizedException("Invalid authentication principal");
        }
    }
}
