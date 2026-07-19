package com.outreach.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PreferencesRequest(
        @NotBlank
        @Pattern(regexp = "in_app|email",
                 message = "channel must be one of: in_app, email")
        String channel
) {}
