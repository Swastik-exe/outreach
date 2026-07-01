package com.outreach.ai.provider;

/**
 * Thrown on network, timeout, or HTTP 5xx failures.
 * Counted toward the circuit-breaker failure rate.
 */
public class ProviderFailureException extends RuntimeException {
    public ProviderFailureException(String message) { super(message); }
    public ProviderFailureException(String message, Throwable cause) { super(message, cause); }
}
