package com.outreach.tracker.dto;

import jakarta.validation.constraints.NotBlank;

public record OutcomeRequest(
        /** interview_got | offer_got | rejected_after_interview */
        @NotBlank String outcome
) {}
