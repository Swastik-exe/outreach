package com.outreach.score;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.score.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/career-score")
@RequiredArgsConstructor
public class ScoreController {

    private final ScoreService scoreService;
    private final CohortService cohortService;
    private final ShareCardService shareCardService;
    private final ObjectMapper objectMapper;

    /** GET /career-score — summary view with band + next_action. */
    @GetMapping
    public ResponseEntity<ApiResponse<CareerScoreResponse>> getScore() {
        UUID userId = CurrentUser.getUserId();
        CareerHealthScore score = scoreService.getOrCompute(userId);
        return ResponseEntity.ok(ApiResponse.ok(toSummary(score)));
    }

    /** GET /career-score/breakdown — per-component detail with reasons + next actions. */
    @GetMapping("/breakdown")
    public ResponseEntity<ApiResponse<BreakdownResponse>> getBreakdown() {
        UUID userId = CurrentUser.getUserId();
        CareerHealthScore score = scoreService.getOrCompute(userId);
        return ResponseEntity.ok(ApiResponse.ok(toBreakdown(score)));
    }

    /** GET /career-score/history — last 90 days, paginated. */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<HistoryEntry>>> getHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = CurrentUser.getUserId();
        var result = scoreService.getHistory(userId,
                        org.springframework.data.domain.PageRequest.of(
                                com.outreach.common.PageParams.safePage(page),
                                com.outreach.common.PageParams.safeSize(size)))
                .map(h -> HistoryEntry.builder()
                        .recordedDate(h.getRecordedDate())
                        .overallScore(h.getOverallScore())
                        .band(ScoreComponents.toBand(h.getOverallScore()))
                        .build());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /** POST /career-score/refresh — rate-limited recompute (1/min per user). */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<CareerScoreResponse>> refresh() {
        UUID userId = CurrentUser.getUserId();
        CareerHealthScore score = scoreService.refreshWithRateLimit(userId);
        return ResponseEntity.ok(ApiResponse.ok(toSummary(score)));
    }

    /** GET /career-score/cohort — percentile band for the requesting user only. */
    @GetMapping("/cohort")
    public ResponseEntity<ApiResponse<CohortInsightResponse>> getCohort() {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(cohortService.getCohortInsight(userId)));
    }

    /** GET /career-score/share-card — server-rendered PNG (variant=score|progress). */
    @GetMapping(value = "/share-card", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getShareCard(
            @RequestParam(defaultValue = "score") String variant) {
        UUID userId = CurrentUser.getUserId();
        ShareCardService.Variant v = "progress".equalsIgnoreCase(variant)
                ? ShareCardService.Variant.PROGRESS
                : ShareCardService.Variant.SCORE;
        byte[] png = shareCardService.render(userId, v);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .contentType(MediaType.IMAGE_PNG)
                .body(png);
    }

    // ── mappers ──────────────────────────────────────────────────────────────

    private CareerScoreResponse toSummary(CareerHealthScore s) {
        String band = s.getBand() != null ? s.getBand() : ScoreComponents.toBand(safe(s.getOverallScore()));
        return CareerScoreResponse.builder()
                .overallScore(safe(s.getOverallScore()))
                .band(band)
                .bandRange(ScoreComponents.toBandRange(band))
                .resumeScore(safe(s.getResumeScore()))
                .applicationsScore(safe(s.getApplicationsScore()))
                .skillsScore(safe(s.getSkillsScore()))
                .profileScore(safe(s.getProfileScore()))
                .githubScore(safe(s.getGithubScore()))
                .cgpaComponent(safe(s.getCgpaComponent()))
                .githubWeightRedistributed(Boolean.TRUE.equals(s.getGithubWeightRedistributed()))
                .nextAction(s.getNextAction())
                .isStale(Boolean.TRUE.equals(s.getIsStale()))
                .lastComputedAt(s.getLastComputedAt())
                .readinessNote(ScoreService.READINESS_NOTE)
                .build();
    }

    private BreakdownResponse toBreakdown(CareerHealthScore s) {
        String band = s.getBand() != null ? s.getBand() : ScoreComponents.toBand(safe(s.getOverallScore()));
        BreakdownResponse.BreakdownResponseBuilder b = BreakdownResponse.builder()
                .overallScore(safe(s.getOverallScore()))
                .band(band)
                .githubWeightRedistributed(Boolean.TRUE.equals(s.getGithubWeightRedistributed()))
                .nextAction(s.getNextAction())
                .readinessNote(ScoreService.READINESS_NOTE);

        // Parse stored breakdown JSONB for per-component detail
        if (s.getBreakdown() != null) {
            try {
                JsonNode root = objectMapper.readTree(s.getBreakdown());
                b.resume(readComponent(root, "resume"))
                 .applications(readComponent(root, "applications"))
                 .skills(readComponent(root, "skills"))
                 .profile(readComponent(root, "profile"))
                 .github(readComponent(root, "github"))
                 .cgpa(readComponent(root, "cgpa"));
            } catch (Exception e) {
                log.warn("Failed to parse breakdown JSON for score {}", s.getId(), e);
            }
        }
        return b.build();
    }

    private ComponentBreakdown readComponent(JsonNode root, String key) {
        JsonNode n = root.path(key);
        return ComponentBreakdown.builder()
                .value(n.path("value").asInt(0))
                .max(n.path("max").asInt(0))
                .upside(n.path("upside").asInt(0))
                .reason(n.path("reason").asText(""))
                .nextAction(n.path("next_action").isNull() ? null : n.path("next_action").asText())
                .build();
    }

    private int safe(Integer val) {
        return val != null ? val : 0;
    }
}
