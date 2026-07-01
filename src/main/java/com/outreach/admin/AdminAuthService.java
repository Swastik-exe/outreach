package com.outreach.admin;

import com.outreach.billing.PlanTier;
import com.outreach.common.exception.ForbiddenException;
import com.outreach.common.exception.NotFoundException;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * PLATFORM_ADMIN gate — maps to {@code users.plan_tier = admin} in the schema.
 */
@Service
@RequiredArgsConstructor
public class AdminAuthService {

    public static final String ROLE_PLATFORM_ADMIN = "PLATFORM_ADMIN";

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public void requirePlatformAdmin(UUID userId) {
        if (!isPlatformAdmin(userId)) {
            throw new ForbiddenException("Platform admin access required");
        }
    }

    @Transactional(readOnly = true)
    public boolean isPlatformAdmin(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return user.getPlanTier() == PlanTier.admin;
    }

    public static String roleFor(User user) {
        return user.getPlanTier() == PlanTier.admin ? ROLE_PLATFORM_ADMIN : "USER";
    }
}
