package com.outreach.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.Map;

/**
 * Generic API envelope for all controller responses.
 * Use {@link #ok(Object)} for success and {@link #error(String, ApiErrorCode)} for failures.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final String error;
    /** Machine-readable code — clients should branch on this, not {@link #error} text. */
    private final String errorCode;
    private final Map<String, Object> meta;

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .meta(Map.of("timestamp", Instant.now().toString()))
                .build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return error(message, null);
    }

    public static <T> ApiResponse<T> error(String message, ApiErrorCode code) {
        return ApiResponse.<T>builder()
                .success(false)
                .error(message)
                .errorCode(code != null ? code.name() : null)
                .meta(Map.of("timestamp", Instant.now().toString()))
                .build();
    }
}
