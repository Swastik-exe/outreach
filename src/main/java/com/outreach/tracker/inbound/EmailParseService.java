package com.outreach.tracker.inbound;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts application fields (company, role, date) from inbound email content.
 *
 * Strategy: try Gemini → try Groq → fall back to regex.
 * The AI path makes a direct lightweight call (not via AiRouter) because
 * the I/O schema is different from resume analysis — we need company/role/date/confidence,
 * not readiness/keyword/impact scores.
 *
 * Confidence < 0.6 → draft is still created but flagged for manual review.
 */
@Slf4j
@Service
public class EmailParseService {

    private static final String GEMINI_URL_TEMPLATE =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";
    private static final String GROQ_URL =
            "https://api.groq.com/openai/v1/chat/completions";

    // Regex patterns for fallback parsing
    private static final Pattern SUBJECT_AT  = Pattern.compile(
            "(?i)(?:re:|fwd:|fw:)?\\s*(?:application|applied|apply)\\s+(?:for\\s+)?(.+?)\\s+(?:at|@|\\bat\\b)\\s+(.+?)(?:\\s*[-–|]|$)");
    private static final Pattern SUBJECT_DASH = Pattern.compile(
            "(?i)(?:re:|fwd:|fw:)?\\s*(.+?)\\s+[-–|]\\s+(.+?)(?:\\s*[-–|]|$)");
    private static final Pattern DATE_ISO    = Pattern.compile(
            "\\b(\\d{4}-\\d{2}-\\d{2})\\b");
    private static final Pattern DATE_WORDS  = Pattern.compile(
            "(?i)\\b(\\d{1,2})\\s+(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(\\d{4})\\b");

    private static final String PARSE_PROMPT = """
            You are an email parser extracting job application information.
            Given the email subject and body below, extract:
            - company: the company/organization name the user applied to
            - role: the job title/role applied for
            - appliedDate: the date the application was submitted (YYYY-MM-DD), or null if unknown
            - confidence: a float 0.0-1.0 indicating how confident you are in the extraction
            
            Respond ONLY with valid JSON in this exact format:
            {"company":"CompanyName","role":"Job Title","appliedDate":"YYYY-MM-DD","confidence":0.85}
            
            If you cannot determine a field, use null for strings and 0.3 for confidence.
            
            EMAIL SUBJECT: %s
            EMAIL BODY (first 1000 chars): %s
            """;

    private final String geminiKey;
    private final String geminiModel;
    private final String groqKey;
    private final String groqModel;
    private final ObjectMapper mapper;
    private final HttpClient http;

    public EmailParseService(
            @Value("${app.ai.gemini.api-key:}") String geminiKey,
            @Value("${app.ai.gemini.model:gemini-1.5-flash}") String geminiModel,
            @Value("${app.ai.groq.api-key:}") String groqKey,
            @Value("${app.ai.groq.model:llama-3.1-8b-instant}") String groqModel,
            ObjectMapper mapper) {
        this.geminiKey   = geminiKey;
        this.geminiModel = geminiModel;
        this.groqKey     = groqKey;
        this.groqModel   = groqModel;
        this.mapper      = mapper;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public EmailParseResult parse(String subject, String bodyText) {
        // Sanitize inputs
        String safeSubject = sanitize(subject, 200);
        String safeBody    = sanitize(bodyText, 2000);

        // AI path (Gemini first, then Groq)
        if (geminiKey != null && !geminiKey.isBlank()) {
            try {
                return parseWithGemini(safeSubject, safeBody);
            } catch (Exception e) {
                log.warn("Gemini email parse failed: {}", e.getMessage());
            }
        }

        if (groqKey != null && !groqKey.isBlank()) {
            try {
                return parseWithGroq(safeSubject, safeBody);
            } catch (Exception e) {
                log.warn("Groq email parse failed: {}", e.getMessage());
            }
        }

        // Regex fallback
        return parseWithRegex(safeSubject, safeBody);
    }

    // ── Gemini ────────────────────────────────────────────────────────────────

    private EmailParseResult parseWithGemini(String subject, String body) throws Exception {
        String prompt = PARSE_PROMPT.formatted(subject, body.substring(0, Math.min(body.length(), 1000)));
        String reqBody = """
                {"contents":[{"parts":[{"text":%s}]}],"generationConfig":{"maxOutputTokens":200}}
                """.formatted(jsonString(prompt)).strip();

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_URL_TEMPLATE.formatted(geminiModel, geminiKey)))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(reqBody))
                .timeout(Duration.ofSeconds(20))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) throw new RuntimeException("Gemini status " + resp.statusCode());

        JsonNode root = mapper.readTree(resp.body());
        String text = root.path("candidates").get(0)
                .path("content").path("parts").get(0).path("text").asText();
        return parseAiJson(text, "ai/gemini");
    }

    // ── Groq ──────────────────────────────────────────────────────────────────

    private EmailParseResult parseWithGroq(String subject, String body) throws Exception {
        String prompt = PARSE_PROMPT.formatted(subject, body.substring(0, Math.min(body.length(), 1000)));
        String reqBody = """
                {"model":"%s","messages":[{"role":"user","content":%s}],"max_tokens":200}
                """.formatted(groqModel, jsonString(prompt)).strip();

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(GROQ_URL))
                .header("Authorization", "Bearer " + groqKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(reqBody))
                .timeout(Duration.ofSeconds(20))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) throw new RuntimeException("Groq status " + resp.statusCode());

        JsonNode root = mapper.readTree(resp.body());
        String text = root.path("choices").get(0).path("message").path("content").asText();
        return parseAiJson(text, "ai/groq");
    }

    // ── Parse AI JSON response ────────────────────────────────────────────────

    private EmailParseResult parseAiJson(String text, String source) throws Exception {
        // Extract the JSON object from the text (might have surrounding prose)
        int start = text.indexOf('{');
        int end   = text.lastIndexOf('}');
        if (start < 0 || end < 0) throw new RuntimeException("No JSON found in AI response");

        JsonNode json = mapper.readTree(text.substring(start, end + 1));
        String company   = json.path("company").isNull()     ? null : json.path("company").asText(null);
        String role      = json.path("role").isNull()        ? null : json.path("role").asText(null);
        String dateStr   = json.path("appliedDate").isNull() ? null : json.path("appliedDate").asText(null);
        double confidence = json.path("confidence").asDouble(0.3);

        LocalDate date = parseDate(dateStr);

        return new EmailParseResult(
                company, role, date != null ? date : LocalDate.now(),
                BigDecimal.valueOf(confidence).min(BigDecimal.ONE).max(BigDecimal.ZERO),
                source
        );
    }

    // ── Regex fallback ────────────────────────────────────────────────────────

    private EmailParseResult parseWithRegex(String subject, String body) {
        String company = null;
        String role    = null;

        // Try "Role at Company" pattern in subject
        Matcher m1 = SUBJECT_AT.matcher(subject);
        if (m1.find()) {
            role    = m1.group(1).trim();
            company = m1.group(2).trim();
        }

        // Try "Role - Company" pattern in subject
        if (company == null) {
            Matcher m2 = SUBJECT_DASH.matcher(subject);
            if (m2.find()) {
                role    = m2.group(1).trim();
                company = m2.group(2).trim();
            }
        }

        // Find a date in the body
        LocalDate date = findDateInText(body);
        if (date == null) date = LocalDate.now();

        double confidence = (company != null && role != null) ? 0.55 : 0.3;

        return new EmailParseResult(
                company, role, date,
                BigDecimal.valueOf(confidence),
                "regex"
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private LocalDate findDateInText(String text) {
        // ISO date first
        Matcher iso = DATE_ISO.matcher(text);
        if (iso.find()) {
            try { return LocalDate.parse(iso.group(1)); } catch (Exception ignored) {}
        }
        // Wordy date: "27 June 2026"
        Matcher wordy = DATE_WORDS.matcher(text);
        if (wordy.find()) {
            try {
                return LocalDate.parse(
                        wordy.group(1) + " " + wordy.group(2) + " " + wordy.group(3),
                        DateTimeFormatter.ofPattern("d MMMM yyyy")
                );
            } catch (Exception ignored) {}
        }
        return null;
    }

    private static String sanitize(String input, int maxLen) {
        if (input == null) return "";
        // Strip potential prompt-injection markers
        String cleaned = input
                .replaceAll("(?i)ignore (previous|above|prior) instructions?.*", "")
                .replaceAll("(?i)\\bsystem:\\s*", "")
                .replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", ""); // control chars
        return cleaned.length() > maxLen ? cleaned.substring(0, maxLen) : cleaned;
    }

    private static String jsonString(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                + "\"";
    }
}
