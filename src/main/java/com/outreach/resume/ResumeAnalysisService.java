package com.outreach.resume;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.ai.AiInteractionLogger;
import com.outreach.ai.provider.AiRequest;
import com.outreach.ai.provider.AiResponse;
import com.outreach.ai.provider.AiRouter;
import com.outreach.billing.PlanConfig;
import com.outreach.billing.QuotaService;
import com.outreach.common.exception.TooManyRequestsException;
import com.outreach.score.ScoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Orchestrates resume analysis:
 *   1. Atomic quota check (fails with 429 if over limit).
 *   2. Routes through AiRouter (Gemini → Groq → rule-based).
 *   3. Persists results to the resume entity.
 *   4. Refunds quota on hard failure.
 *   5. Logs the AI interaction asynchronously.
 *
 * PRIVACY NOTE: resume text is sent to 3rd-party AI when keys are present.
 * A consent/privacy disclosure must be shown to users before enabling AI.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeAnalysisService {

    static final String METRIC = PlanConfig.METRIC_RESUME;

    private final ResumeRepository       resumeRepo;
    private final QuotaService           quotaService;
    private final AiRouter               aiRouter;
    private final AiInteractionLogger    logger;
    private final ObjectMapper           objectMapper;
    private final ScoreService           scoreService;

    /**
     * Synchronously analyse a resume that already has parsed text.
     * Called from ResumeService after upload+parse or on-demand via the endpoint.
     * Throws {@link com.outreach.common.exception.TooManyRequestsException} (HTTP 429) if the user is at their limit.
     */
    @Transactional
    public Resume analyze(Resume resume, UUID userId) {
        if (resume.getRawText() == null || resume.getRawText().isBlank()) {
            resume.setAnalysisStatus("failed");
            resume.setAnalysisSource(null);
            resumeRepo.save(resume);
            return resume;
        }

        // -- Atomic quota via QuotaService (lazy reset + plan-aware limits) --
        try {
            quotaService.consume(userId, METRIC);
        } catch (TooManyRequestsException e) {
            throw e;
        }

        long start = System.currentTimeMillis();
        boolean success = false;
        AiResponse aiResponse = null;
        try {
            aiResponse = aiRouter.analyze(new AiRequest(
                    resume.getRawText(),
                    resume.getTargetRole(),
                    "resume_analysis"
            ));

            applyResults(resume, aiResponse);
            success = true;
            Resume saved = resumeRepo.save(resume);
            scoreService.markStale(userId);
            return saved;
        } catch (Exception e) {
            log.error("Analysis failed for resume {}: {}", resume.getId(), e.getMessage(), e);
            resume.setAnalysisStatus("failed");
            resumeRepo.save(resume);
            quotaService.refund(userId, METRIC);
            throw e;
        } finally {
            long latency = System.currentTimeMillis() - start;
            if (aiResponse != null) {
                logger.log(userId, "resume_analysis", aiResponse, latency, success);
            }
        }
    }

    /**
     * Async version triggered immediately after upload+parse completes.
     * Runs on freePool; any failure marks the resume as failed but never
     * propagates to the HTTP thread.
     */
    @Async("freePool")
    @Transactional
    public void analyzeAsync(UUID resumeId, UUID userId) {
        resumeRepo.findById(resumeId).ifPresent(r -> {
            try {
                analyze(r, userId);
            } catch (TooManyRequestsException e) {
                log.warn("Quota exceeded during async analysis for user {}", userId);
                r.setAnalysisStatus("failed");
                resumeRepo.save(r);
            } catch (Exception e) {
                log.error("Async analysis failed for resume {}: {}", resumeId, e.getMessage(), e);
            }
        });
    }

    // -------------------------------------------------------------------------

    private void applyResults(Resume resume, AiResponse r) {
        resume.setReadinessScore(r.readinessScore());
        resume.setKeywordScore(r.keywordScore());
        resume.setImpactScore(r.impactScore());
        resume.setFormattingScore(r.formattingScore());
        resume.setKeywordGaps(r.keywordGaps().toArray(String[]::new));
        resume.setAnalysisSource("rule_based".equals(r.provider()) ? "rule_based" : "ai");
        resume.setAnalysisStatus("rule_based".equals(r.provider()) ? "done_basic" : "done");
        resume.setAnalyzedAt(java.time.OffsetDateTime.now());

        // Serialize fixes list to JSONB string
        try {
            resume.setAiFixes(objectMapper.writeValueAsString(r.fixes()));
        } catch (JsonProcessingException e) {
            resume.setAiFixes("[]");
        }
    }
}
