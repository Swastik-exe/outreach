package com.outreach.ai.provider;

/**
 * Contract every AI provider must implement.
 * Implementations must throw {@link ProviderFailureException} for network/5xx failures
 * and {@link SchemaValidationException} for malformed responses (so the CB does not trip).
 */
public interface AiProvider {

    /**
     * Returns true when the provider's API key is configured and non-blank.
     * AiRouter skips disabled providers without touching the circuit breaker.
     */
    boolean isEnabled();

    String providerName();

    /**
     * Analyze a resume.  Never returns null on success.
     *
     * @throws ProviderFailureException   on network / timeout / 5xx — trips the circuit breaker.
     * @throws SchemaValidationException  on bad JSON / missing fields — does NOT trip the CB.
     */
    AiResponse analyze(AiRequest request) throws ProviderFailureException, SchemaValidationException;
}
