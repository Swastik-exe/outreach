package com.outreach.billing.dto;

public record CheckoutResponse(
        String razorpayKeyId,
        /** Set for one-time Season Pass checkout. */
        String orderId,
        /** Set for recurring monthly/annual checkout. */
        String subscriptionId,
        int amountInr,
        String currency,
        String plan,
        boolean sandbox,
        String prefillEmail
) {}
