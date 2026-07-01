package com.outreach.tracker.inbound.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ForwardingAddressResponse(
        UUID id,
        String address,
        OffsetDateTime createdAt
) {}
