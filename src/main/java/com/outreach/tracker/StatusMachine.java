package com.outreach.tracker;

import com.outreach.common.exception.BadRequestException;

import java.util.Set;

/**
 * Validates app_status transitions.
 *
 * Rules (FR-4.3):
 * - Terminal states (offer_accepted, offer_declined, rejected, ghosted, withdrawn)
 *   CANNOT be left — any further transition is blocked.
 * - Non-terminal → any status is permitted (supports skips and corrections).
 */
public final class StatusMachine {

    private StatusMachine() {}

    static final Set<AppStatus> TERMINAL = Set.of(
            AppStatus.offer_accepted,
            AppStatus.offer_declined,
            AppStatus.rejected,
            AppStatus.ghosted,
            AppStatus.withdrawn
    );

    /**
     * Validates that transitioning from {@code from} to {@code to} is legal.
     *
     * @throws BadRequestException if the transition is blocked.
     */
    public static void validate(AppStatus from, AppStatus to) {
        if (TERMINAL.contains(from)) {
            throw new BadRequestException(
                    "Cannot change status: '" + from.name() + "' is a terminal state. "
                    + "Soft-delete the application and create a new one if needed.");
        }
        // Non-terminal → anything is fine (allows skips and back-corrections)
    }

    /** True if the given status is terminal. */
    public static boolean isTerminal(AppStatus status) {
        return TERMINAL.contains(status);
    }

    /** Parse a status string, returning a helpful error if unknown. */
    public static AppStatus parse(String raw) {
        try {
            return AppStatus.valueOf(raw.toLowerCase().trim());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(
                    "Unknown status '" + raw + "'. Valid values: applied, pending_oa, oa_submitted, "
                    + "interview_scheduled, interview_done, technical_round, hr_round, shortlisted, "
                    + "offer_received, offer_accepted, offer_declined, rejected, ghosted, withdrawn");
        }
    }
}
