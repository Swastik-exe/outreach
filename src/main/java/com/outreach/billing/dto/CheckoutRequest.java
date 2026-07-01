package com.outreach.billing.dto;

import java.time.OffsetDateTime;

public record CheckoutRequest(
        /** monthly | annual | seasonPass */
        String plan
) {}
