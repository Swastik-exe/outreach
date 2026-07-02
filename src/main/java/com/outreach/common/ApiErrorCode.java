package com.outreach.common;

/**
 * Machine-readable error codes returned in {@link ApiResponse#errorCode}.
 * Clients should branch on these rather than parsing human messages.
 */
public enum ApiErrorCode {
    VALIDATION_ERROR,
    UNAUTHORIZED,
    FORBIDDEN,
    ACCOUNT_SUSPENDED,
    NOT_FOUND,
    CONFLICT,
    RATE_LIMITED,
    SERVICE_UNAVAILABLE,
    GATEWAY_TIMEOUT,
    INVALID_FILE,
    QUOTA_EXCEEDED,
    INTERNAL_ERROR
}
