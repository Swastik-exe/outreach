package com.outreach.common.exception;

import com.outreach.common.ApiErrorCode;
import org.springframework.http.HttpStatus;

public class AppException extends RuntimeException {
    private final HttpStatus status;
    private final ApiErrorCode errorCode;

    public AppException(String message, HttpStatus status) {
        this(message, status, defaultCode(status));
    }

    public AppException(String message, HttpStatus status, ApiErrorCode errorCode) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public ApiErrorCode getErrorCode() {
        return errorCode;
    }

    private static ApiErrorCode defaultCode(HttpStatus status) {
        return switch (status.value()) {
            case 400 -> ApiErrorCode.VALIDATION_ERROR;
            case 401 -> ApiErrorCode.UNAUTHORIZED;
            case 403 -> ApiErrorCode.FORBIDDEN;
            case 404 -> ApiErrorCode.NOT_FOUND;
            case 409 -> ApiErrorCode.CONFLICT;
            case 429 -> ApiErrorCode.RATE_LIMITED;
            case 503 -> ApiErrorCode.SERVICE_UNAVAILABLE;
            case 504 -> ApiErrorCode.GATEWAY_TIMEOUT;
            default -> ApiErrorCode.INTERNAL_ERROR;
        };
    }
}
