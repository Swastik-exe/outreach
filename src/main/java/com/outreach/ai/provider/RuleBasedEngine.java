package com.outreach.ai.provider;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Pure rule-based fallback that NEVER throws.  Produces "done_basic" results
 * without any network call.  Used when no AI keys are configured or all
 * providers have failed/are tripped.
 */
@Component
public class RuleBasedEngine implements AiProvider {

    private static final Pattern QUANTIFICATION = Pattern.compile(
            "\\b(\\d+[%x]|\\d+\\s*(users?|customers?|requests?|ms|seconds?|hours?|TB|GB|MB|K|M|B))\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CONTACT = Pattern.compile(
            "(?i)(email|phone|linkedin|github|@|\\+?\\d[\\d\\s\\-]{8,})"
    );
    private static final List<String> SECTION_MARKERS = List.of(
            "education", "experience", "skills", "projects", "summary",
            "objective", "certifications", "awards", "publications"
    );
    private static final List<String> ACTION_VERBS = List.of(
            "developed", "built", "designed", "implemented", "led", "managed",
            "optimized", "reduced", "increased", "created", "delivered", "deployed",
            "architected", "automated", "improved", "collaborated", "mentored"
    );

    /* Maps generic target roles to relevant keywords */
    private static final Map<String, List<String>> ROLE_KEYWORDS = Map.of(
            "Software Engineer", List.of("java", "python", "sql", "api", "microservices",
                    "docker", "kubernetes", "ci/cd", "git", "agile"),
            "Data Scientist", List.of("python", "ml", "tensorflow", "pytorch", "sql",
                    "statistics", "pandas", "numpy", "jupyter", "tableau"),
            "Product Manager", List.of("roadmap", "stakeholder", "agile", "scrum",
                    "metrics", "kpi", "user research", "jira", "product strategy"),
            "default", List.of("communication", "teamwork", "leadership",
                    "problem-solving", "project management")
    );

    @Override
    public boolean isEnabled() { return true; }

    @Override
    public String providerName() { return "rule_based"; }

    @Override
    public AiResponse analyze(AiRequest request) {
        String text = request.resumeText() == null ? "" : request.resumeText().toLowerCase();
        String targetRole = request.targetRole() != null ? request.targetRole() : "default";

        int keywordScore = computeKeywordScore(text, targetRole);
        int impactScore  = computeImpactScore(text);
        int formattingScore = computeFormattingScore(text);
        int readinessScore = (keywordScore + impactScore + formattingScore) / 3;

        List<String> gaps = computeGaps(text, targetRole);
        List<String> fixes = buildFixes(text, keywordScore, impactScore, formattingScore);

        return new AiResponse(
                readinessScore, keywordScore, impactScore, formattingScore,
                gaps, fixes,
                providerName(), "rule_engine_v1", 0, 0
        );
    }

    private int computeKeywordScore(String text, String role) {
        List<String> keywords = ROLE_KEYWORDS.getOrDefault(role, ROLE_KEYWORDS.get("default"));
        long matched = keywords.stream().filter(text::contains).count();
        return (int) Math.min(100, (matched * 100L) / keywords.size());
    }

    private int computeImpactScore(String text) {
        int score = 0;
        // Quantified results
        long quantCount = QUANTIFICATION.matcher(text).results().count();
        score += (int) Math.min(40, quantCount * 8);
        // Action verbs
        long verbCount = ACTION_VERBS.stream().filter(text::contains).count();
        score += (int) Math.min(40, verbCount * 4);
        // Length heuristic (500-1500 words is ideal)
        int words = text.split("\\s+").length;
        if (words >= 200 && words <= 800) score += 20;
        else if (words > 100) score += 10;
        return Math.min(100, score);
    }

    private int computeFormattingScore(String text) {
        int score = 0;
        // Contact info present
        if (CONTACT.matcher(text).find()) score += 25;
        // Has multiple sections
        long sectionCount = SECTION_MARKERS.stream().filter(text::contains).count();
        score += (int) Math.min(50, sectionCount * 10);
        // Not too short / too long
        int chars = text.length();
        if (chars > 500 && chars < 8000) score += 25;
        return Math.min(100, score);
    }

    private List<String> computeGaps(String text, String role) {
        List<String> keywords = ROLE_KEYWORDS.getOrDefault(role, ROLE_KEYWORDS.get("default"));
        return keywords.stream().filter(k -> !text.contains(k)).limit(10).toList();
    }

    private List<String> buildFixes(String text, int keywordScore, int impactScore, int formattingScore) {
        List<String> fixes = new ArrayList<>();
        if (keywordScore < 60) fixes.add("Add more role-relevant technical keywords throughout your resume");
        if (impactScore < 50) fixes.add("Quantify achievements with numbers (e.g. 'reduced latency by 40%')");
        if (!CONTACT.matcher(text).find()) fixes.add("Add clear contact information (email, LinkedIn, phone)");
        long sectionCount = SECTION_MARKERS.stream().filter(text::contains).count();
        if (sectionCount < 3) fixes.add("Add clearly labelled sections: Education, Experience, Skills");
        if (impactScore < 40) fixes.add("Start bullet points with strong action verbs (Led, Built, Reduced)");
        if (formattingScore < 60) fixes.add("Ensure resume is between 1-2 pages; avoid excessive white space");
        if (text.split("\\s+").length < 200) fixes.add("Expand descriptions to better demonstrate scope of impact");
        return fixes.stream().limit(10).toList();
    }
}
