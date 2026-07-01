package com.outreach.ai.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Groq (OpenAI-compatible) provider.  Enabled only when GROQ_API_KEY is non-blank.
 */
@Slf4j
@Component
public class GroqProvider implements AiProvider {

    static final int PROMPT_VERSION = 1;

    private static final String URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String model;
    private final int maxTokens;
    private final Duration timeout;
    private final HttpClient http;

    public GroqProvider(
            @Value("${app.ai.groq.api-key:}") String apiKey,
            @Value("${app.ai.groq.model:llama-3.1-8b-instant}") String model,
            @Value("${app.ai.groq.max-tokens:1024}") int maxTokens,
            @Value("${app.ai.groq.timeout-seconds:30}") int timeoutSeconds
    ) {
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @Override
    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public String providerName() { return "groq"; }

    @Override
    public AiResponse analyze(AiRequest request) throws ProviderFailureException, SchemaValidationException {
        String prompt = buildPrompt(request);

        ObjectNode body = MAPPER.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        body.put("temperature", 0.1);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "user").put("content", prompt);

        String requestBody;
        try {
            requestBody = MAPPER.writeValueAsString(body);
        } catch (Exception e) {
            throw new ProviderFailureException("Failed to serialize request", e);
        }

        long start = System.currentTimeMillis();
        HttpResponse<String> response;
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(URL))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(timeout)
                    .build();
            response = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new ProviderFailureException("Groq request failed: " + e.getMessage(), e);
        }

        if (response.statusCode() >= 500) {
            throw new ProviderFailureException("Groq returned HTTP " + response.statusCode());
        }
        if (response.statusCode() == 429) {
            throw new ProviderFailureException("Groq rate limit exceeded");
        }
        if (response.statusCode() >= 400) {
            throw new SchemaValidationException("Groq client error " + response.statusCode());
        }

        String jsonText = extractContent(response.body());
        int[] tokens = extractTokenUsage(response.body());

        log.debug("Groq latency={}ms inputTokens={} outputTokens={}",
                System.currentTimeMillis() - start, tokens[0], tokens[1]);

        return ResponseSchemaValidator.parse(jsonText, providerName(), model, tokens[0], tokens[1]);
    }

    private String extractContent(String body) throws SchemaValidationException {
        try {
            JsonNode root = MAPPER.readTree(body);
            return root.at("/choices/0/message/content").asText();
        } catch (Exception e) {
            throw new SchemaValidationException("Cannot parse Groq response: " + e.getMessage());
        }
    }

    private int[] extractTokenUsage(String body) {
        try {
            JsonNode root = MAPPER.readTree(body);
            int input = root.at("/usage/prompt_tokens").asInt(0);
            int output = root.at("/usage/completion_tokens").asInt(0);
            return new int[]{input, output};
        } catch (Exception e) {
            return new int[]{0, 0};
        }
    }

    private String buildPrompt(AiRequest request) {
        String role = request.targetRole() != null ? request.targetRole() : "Software Engineer";
        String resumeText = PromptSanitizer.sanitize(request.resumeText());
        return """
                [PROMPT_VERSION=%d]
                You are a professional resume analyst. Analyze the following resume for a "%s" role.
                Return ONLY a valid JSON object with exactly these fields (no markdown, no explanation):
                {
                  "readiness_score": <integer 0-100>,
                  "keyword_score": <integer 0-100>,
                  "impact_score": <integer 0-100>,
                  "formatting_score": <integer 0-100>,
                  "keyword_gaps": ["skill1", "skill2"],
                  "ai_fixes": ["fix1", "fix2"]
                }
                
                Resume:
                %s
                """.formatted(PROMPT_VERSION, role, resumeText);
    }
}
