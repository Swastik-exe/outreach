package com.outreach.billing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CheckoutRequest(
        /** monthly | annual | seasonPass */
        @NotBlank
        @Pattern(regexp = "monthly|annual|seasonPass",
                message = "plan must be monthly, annual, or seasonPass")
        String plan
) {}
