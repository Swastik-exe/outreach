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
 * Gemini Flash provider.  Enabled only when GEMINI_API_KEY is non-blank.
 * Prompt version = 1 (stored as constant, bump when prompt changes).
 */
@Slf4j
@Component
public class GeminiProvider implements AiProvider {

    static final int PROMPT_VERSION = 1;

    private static final String BASE_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String model;
    private final int maxTokens;
    private final Duration timeout;
    private final HttpClient http;

    public GeminiProvider(
            @Value("${app.ai.gemini.api-key:}") String apiKey,
            @Value("${app.ai.gemini.model:gemini-1.5-flash}") String model,
            @Value("${app.ai.gemini.max-tokens:1024}") int maxTokens,
            @Value("${app.ai.gemini.timeout-seconds:30}") int timeoutSeconds
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
    public String providerName() { return "gemini"; }

    @Override
    public AiResponse analyze(AiRequest request) throws ProviderFailureException, SchemaValidationException {
        String prompt = buildPrompt(request);
        ObjectNode body = MAPPER.createObjectNode();
        ArrayNode contents = body.putArray("contents");
        ObjectNode part = contents.addObject().putArray("parts").addObject();
        part.put("text", prompt);
        ObjectNode genConfig = body.putObject("generationConfig");
        genConfig.put("maxOutputTokens", maxTokens);
        genConfig.put("temperature", 0.1);
        // 2.x "thinking" models spend part of maxOutputTokens on hidden reasoning
        // before the answer, which was truncating our JSON. Not needed for this
        // structured-extraction task, so disable it.
        genConfig.putObject("thinkingConfig").put("thinkingBudget", 0);

        String url = BASE_URL.formatted(model) + "?key=" + apiKey;
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
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(timeout)
                    .build();
            response = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new ProviderFailureException("Gemini request failed: " + e.getMessage(), e);
        }

        if (response.statusCode() >= 500) {
            throw new ProviderFailureException("Gemini returned HTTP " + response.statusCode());
        }
        if (response.statusCode() >= 400) {
            // 4xx is a config/auth issue — don't trip the CB, but do fail this request
            throw new SchemaValidationException("Gemini client error " + response.statusCode());
        }

        // Extract text from Gemini response structure
        String jsonText = extractTextFromGeminiResponse(response.body());

        // Estimate tokens from response metadata (Gemini returns usageMetadata)
        int[] tokens = extractTokenUsage(response.body());

        log.debug("Gemini latency={}ms inputTokens={} outputTokens={}",
                System.currentTimeMillis() - start, tokens[0], tokens[1]);

        return ResponseSchemaValidator.parse(jsonText, providerName(), model, tokens[0], tokens[1]);
    }

    private String extractTextFromGeminiResponse(String responseBody) throws SchemaValidationException {
        try {
            JsonNode root = MAPPER.readTree(responseBody);
            return root.at("/candidates/0/content/parts/0/text").asText();
        } catch (Exception e) {
            throw new SchemaValidationException("Cannot extract text from Gemini response: " + e.getMessage());
        }
    }

    private int[] extractTokenUsage(String responseBody) {
        try {
            JsonNode root = MAPPER.readTree(responseBody);
            int input = root.at("/usageMetadata/promptTokenCount").asInt(0);
            int output = root.at("/usageMetadata/candidatesTokenCount").asInt(0);
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
                
                Scoring guide:
                - readiness_score: overall ATS and recruiter readiness
                - keyword_score: presence of role-relevant technical keywords
                - impact_score: quantified achievements, action verbs, measurable results
                - formatting_score: structure, length, readability
                - keyword_gaps: top missing skills/keywords for the role (max 10)
                - ai_fixes: top improvement actions, most impactful first (max 10)
                
                Resume:
                %s
                """.formatted(PROMPT_VERSION, role, resumeText);
    }
}
