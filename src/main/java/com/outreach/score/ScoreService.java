package com.outreach.score;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.common.exception.NotFoundException;
import com.outreach.common.exception.TooManyRequestsException;
import com.outreach.profile.UserProfile;
import com.outreach.profile.UserProfileRepository;
import com.outreach.profile.UserSkill;
import com.outreach.profile.UserSkillRepository;
import com.outreach.resume.Resume;
import com.outreach.resume.ResumeRepository;
import com.outreach.tracker.Application;
import com.outreach.tracker.ApplicationOutcome;
import com.outreach.tracker.ApplicationOutcomeRepository;
import com.outreach.tracker.ApplicationRepository;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Career Health Score computation service.
 *
 * Uses {@link TransactionTemplate} for per-attempt transactions so that
 * each optimistic-lock retry re-reads the latest {@code version} from the DB.
 * Class-level {@code @Transactional} is intentionally absent so retries start fresh.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScoreService {

    private static final int MAX_RETRY = 3;
    private static final Duration REFRESH_COOLDOWN = Duration.ofMinutes(1);
    private static final String REFRESH_KEY_PREFIX = "score:refresh:";
    static final String READINESS_NOTE =
            "This score is a readiness signal to guide your preparation — not a guarantee of placement outcomes.";

    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final UserSkillRepository skillRepository;
    private final ResumeRepository resumeRepository;
    private final ApplicationRepository applicationRepository;
    private final ApplicationOutcomeRepository outcomeRepository;
    private final CareerHealthScoreRepository scoreRepository;
    private final CareerHealthHistoryRepository historyRepository;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redis;
    private final PlatformTransactionManager txManager;

    // ── PUBLIC API ───────────────────────────────────────────────────────────

    /**
     * Computes and persists the career score for {@code userId}.
     * Retries up to {@value #MAX_RETRY} times on optimistic-lock conflicts.
     */
    public CareerHealthScore computeAndSave(UUID userId) {
        TransactionTemplate tx = new TransactionTemplate(txManager);
        Exception last = null;
        for (int attempt = 0; attempt < MAX_RETRY; attempt++) {
            try {
                CareerHealthScore result = tx.execute(status -> doCompute(userId));
                return result;
            } catch (ObjectOptimisticLockingFailureException e) {
                last = e;
                log.warn("Optimistic lock conflict for userId={} attempt {}/{}", userId, attempt + 1, MAX_RETRY);
            }
        }
        throw new RuntimeException("Score computation failed after " + MAX_RETRY + " retries", last);
    }

    /**
     * Marks the user's career score as stale — called from profile/skill/application writes.
     * No-op if no score row exists yet.
     */
    public void markStale(UUID userId) {
        try {
            redis.delete("cache:score:" + userId);
        } catch (Exception ignored) {
            // Redis down — cache miss is fine
        }
        TransactionTemplate tx = new TransactionTemplate(txManager);
        tx.execute(status -> {
            scoreRepository.findByUserId(userId).ifPresent(score -> {
                score.setIsStale(true);
                scoreRepository.save(score);
            });
            return null;
        });
    }

    /**
     * Rate-limited manual refresh — enforced via Redis TTL (1 request / minute).
     */
    public CareerHealthScore refreshWithRateLimit(UUID userId) {
        String key = REFRESH_KEY_PREFIX + userId;
        try {
            Boolean isNew = redis.opsForValue().setIfAbsent(key, "1", REFRESH_COOLDOWN);
            if (!Boolean.TRUE.equals(isNew)) {
                throw new TooManyRequestsException("Score can only be refreshed once per minute");
            }
        } catch (TooManyRequestsException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis unavailable for score refresh rate limit — allowing refresh: {}", e.getMessage());
        }
        return computeAndSave(userId);
    }

    public void recalculateStale() {
        List<CareerHealthScore> stale = scoreRepository.findStaleWithUser();
        log.info("Recalculating {} stale scores", stale.size());
        for (CareerHealthScore s : stale) {
            try {
                computeAndSave(s.getUser().getId());
            } catch (Exception e) {
                log.error("Failed to recalculate score for userId={}", s.getUser().getId(), e);
            }
        }
    }

    public void snapshotHistory() {
        LocalDate today = LocalDate.now();
        List<Object[]> rows = scoreRepository.findAllUserScoresForSnapshot();
        log.info("Snapshotting history for {} users", rows.size());
        for (Object[] row : rows) {
            UUID userId = (UUID) row[0];
            int score = ((Number) row[1]).intValue();
            try {
                historyRepository.upsertHistory(userId, score, today);
            } catch (Exception e) {
                log.error("History snapshot failed for userId={}", userId, e);
            }
        }
    }

    public org.springframework.data.domain.Page<CareerHealthHistory> getHistory(
            UUID userId, org.springframework.data.domain.Pageable pageable) {
        LocalDate since = LocalDate.now().minusDays(90);
        return historyRepository.findByUserIdAndRecordedDateGreaterThanEqualOrderByRecordedDateAsc(
                userId, since, pageable);
    }

    public List<CareerHealthHistory> getHistory(UUID userId) {
        LocalDate since = LocalDate.now().minusDays(90);
        return historyRepository.findByUserIdAndRecordedDateGreaterThanEqualOrderByRecordedDateAsc(userId, since);
    }

    /**
     * Returns the current score, computing it on first call if none exists.
     */
    public CareerHealthScore getOrCompute(UUID userId) {
        return scoreRepository.findByUserId(userId)
                .orElseGet(() -> computeAndSave(userId));
    }

    // ── PRIVATE COMPUTATION ───────────────────────────────────────────────────

    private CareerHealthScore doCompute(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        UserProfile profile = profileRepository.findByUserId(userId).orElse(null);
        Resume resume       = resumeRepository.findByUserIdAndIsActiveTrue(userId).orElse(null);
        List<UserSkill> skills = skillRepository.findByUserId(userId);
        List<Application> apps = applicationRepository.findByUserId(userId);
        List<ApplicationOutcome> outcomes = outcomeRepository.findByUserIdWithApplication(userId);

        Map<UUID, List<ApplicationOutcome>> outcomeMap = outcomes.stream()
                .collect(Collectors.groupingBy(o -> o.getApplication().getId()));

        ComponentResult resumeR   = ScoreComponents.computeResumeScore(resume);
        ComponentResult appsR     = ScoreComponents.computeApplicationsScore(apps, outcomeMap);
        ComponentResult skillsR   = ScoreComponents.computeSkillsScore(skills);
        ComponentResult profileR  = ScoreComponents.computeProfileScore(profile);
        ComponentResult githubR   = ScoreComponents.computeGithubScore(profile);
        ComponentResult cgpaR     = ScoreComponents.computeCgpaScore(profile);

        boolean githubConnected = profile != null && Boolean.TRUE.equals(profile.getGithubConnected());
        int overall = ScoreComponents.computeOverall(
                githubConnected, resumeR, appsR, skillsR, profileR, githubR, cgpaR);

        // Top-level next_action = component with highest upside that has a suggestion
        ComponentResult[] all = { resumeR, appsR, skillsR, profileR, githubR, cgpaR };
        String nextAction = Arrays.stream(all)
                .filter(r -> r.nextAction() != null)
                .max(Comparator.comparingInt(ComponentResult::upside))
                .map(ComponentResult::nextAction)
                .orElse("Great progress — keep applying and progressing!");

        String breakdownJson = buildBreakdown(resumeR, appsR, skillsR, profileR, githubR, cgpaR, githubConnected);

        CareerHealthScore score = scoreRepository.findByUserId(userId)
                .orElseGet(() -> CareerHealthScore.builder().user(user).build());

        score.setOverallScore(overall);
        score.setResumeScore(resumeR.value());
        score.setApplicationsScore(appsR.value());
        score.setSkillsScore(skillsR.value());
        score.setProfileScore(profileR.value());
        score.setGithubScore(githubR.value());
        score.setCgpaComponent(cgpaR.value());
        score.setGithubWeightRedistributed(!githubConnected);
        score.setBreakdown(breakdownJson);
        score.setNextAction(nextAction);
        score.setBand(ScoreComponents.toBand(overall));
        score.setIsStale(false);
        score.setLastComputedAt(OffsetDateTime.now());

        CareerHealthScore saved = scoreRepository.save(score);
        try {
            redis.delete("cache:score:" + userId);
        } catch (Exception ignored) {
            // non-fatal
        }
        log.info("Score computed for userId={}: overall={}, band={}", userId, overall, saved.getBand());
        return saved;
    }

    private String buildBreakdown(ComponentResult resume, ComponentResult apps,
                                  ComponentResult skills, ComponentResult profile,
                                  ComponentResult github, ComponentResult cgpa,
                                  boolean githubConnected) {
        try {
            var node = objectMapper.createObjectNode();
            node.set("resume",       componentNode(resume));
            node.set("applications", componentNode(apps));
            node.set("skills",       componentNode(skills));
            node.set("profile",      componentNode(profile));
            node.set("github",       componentNode(github));
            node.set("cgpa",         componentNode(cgpa));
            node.put("github_weight_redistributed", !githubConnected);
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize breakdown", e);
            return "{}";
        }
    }

    private com.fasterxml.jackson.databind.node.ObjectNode componentNode(ComponentResult r) {
        var node = objectMapper.createObjectNode();
        node.put("value",  r.value());
        node.put("max",    r.max());
        node.put("upside", r.upside());
        node.put("reason", r.reason());
        if (r.nextAction() != null) node.put("next_action", r.nextAction());
        else                        node.putNull("next_action");
        return node;
    }
}
