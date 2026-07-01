package com.outreach.ai.provider;

/**
 * Thrown when the AI returns syntactically valid HTTP 200 but the JSON body
 * does not match the required schema.  Configured as an "ignored" exception in
 * the Resilience4j circuit breakers — does NOT count toward failure rate.
 */
public class SchemaValidationException extends RuntimeException {
    public SchemaValidationException(String message) { super(message); }
}
