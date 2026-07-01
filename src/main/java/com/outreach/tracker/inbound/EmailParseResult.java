package com.outreach.tracker.inbound;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Result of parsing an inbound email for application fields.
 */
public record EmailParseResult(
        String company,
        String role,
        LocalDate appliedDate,
        BigDecimal confidence,   // 0.000–1.000; < 0.6 flags for manual review
        String source            // "ai" | "regex"
) {}
