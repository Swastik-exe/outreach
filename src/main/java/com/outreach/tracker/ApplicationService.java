package com.outreach.tracker;

import com.outreach.common.exception.BadRequestException;
import com.outreach.common.exception.ConflictException;
import com.outreach.common.exception.NotFoundException;
import com.outreach.resume.Resume;
import com.outreach.resume.ResumeRepository;
import com.outreach.score.CareerHealthScoreRepository;
import com.outreach.score.ScoreService;
import com.outreach.tracker.dto.*;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationService {

    private final ApplicationRepository appRepo;
    private final ApplicationTimelineRepository timelineRepo;
    private final ApplicationOutcomeRepository outcomeRepo;
    private final UserRepository userRepo;
    private final ResumeRepository resumeRepo;
    private final CareerHealthScoreRepository scoreRepo;
    private final ScoreService scoreService;

    // ── Create ──────────────────────────────────────────────────────────────────

    /**
     * Add a new application.
     *
     * @param force if true, skip the fuzzy-dedup check (user confirmed it's different).
     */
    @Transactional
    public CreateApplicationResult create(UUID userId, CreateApplicationRequest req, boolean force) {
        String companyCanon = Canonicalizer.canonicalize(req.company());
        String roleCanon    = Canonicalizer.canonicalize(req.role());

        if (companyCanon.isBlank()) {
            throw new BadRequestException("Company name must contain recognisable text after canonicalisation.");
        }

        // --- Fuzzy dedup (unless force=true) ---
        if (!force) {
            Optional<Application> match = appRepo.findFuzzyDuplicate(
                    userId, companyCanon, req.appliedDate());
            if (match.isPresent()) {
                ApplicationResponse existing = toResponse(match.get(), false);
                log.info("Possible duplicate detected for user {} — company='{}' role='{}'",
                        userId, companyCanon, roleCanon);
                return new CreateApplicationResult(null, true, existing);
            }
        }

        // --- Build entity ---
        var user = userRepo.getReferenceById(userId);

        AppSource source = req.source() != null
                ? AppSource.valueOf(req.source().toLowerCase().trim())
                : AppSource.manual;

        Application app = Application.builder()
                .user(user)
                .company(req.company().trim())
                .companyCanonical(companyCanon)
                .role(req.role().trim())
                .roleCanonical(roleCanon)
                .source(source)
                .jobUrl(req.jobUrl())
                .appliedDate(req.appliedDate())
                .currentStatus(AppStatus.applied)
                .priority(req.priority() != null ? req.priority() : "medium")
                .notes(req.notes())
                .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                .updatedAt(OffsetDateTime.now(ZoneOffset.UTC))
                .build();

        if (req.resumeId() != null) {
            app.setResume(requireOwnedResume(req.resumeId(), userId));
        }

        // Follow-up auto-due: 7 days after applied_date when status=applied
        app.setNextActionDue(req.appliedDate().atStartOfDay(ZoneOffset.UTC).toOffsetDateTime().plusDays(7));

        try {
            app = appRepo.save(app);
        } catch (DataIntegrityViolationException ex) {
            // Exact UNIQUE(user_id, company_canonical, role_canonical, applied_date) collision.
            throw new ConflictException(
                    "An exact application for this company, role and date already exists.");
        }

        // Append initial timeline entry
        appendTimeline(app, AppStatus.applied, "Application created", "user");

        // Mark score stale
        scoreService.markStale(userId);

        return new CreateApplicationResult(toResponse(app, false), false, null);
    }

    // ── Read ────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ApplicationResponse> list(UUID userId, String status, Pageable pageable) {
        Page<Application> page = (status != null && !status.isBlank())
                ? appRepo.findByUserIdAndCurrentStatusOrderByAppliedDateDesc(
                        userId, StatusMachine.parse(status), pageable)
                : appRepo.findByUserIdOrderByAppliedDateDesc(userId, pageable);
        return page.map(a -> toResponse(a, false));
    }

    @Transactional(readOnly = true)
    public ApplicationResponse getById(UUID id, UUID userId) {
        Application app = requireOwned(id, userId);
        return toResponse(app, true); // include timeline
    }

    @Transactional(readOnly = true)
    public Page<TimelineEntryResponse> getTimeline(UUID id, UUID userId, Pageable pageable) {
        requireOwned(id, userId);
        return timelineRepo.findByApplicationIdOrderByOccurredAtAsc(id, pageable)
                .map(this::toTimelineEntry);
    }

    @Transactional(readOnly = true)
    public Page<ApplicationResponse> getFollowUpsDue(UUID userId, Pageable pageable) {
        List<Application> all = appRepo.findFollowUpsDue(userId, OffsetDateTime.now(ZoneOffset.UTC));
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), all.size());
        List<ApplicationResponse> slice = all.subList(Math.min(start, all.size()), end)
                .stream().map(a -> toResponse(a, false)).toList();
        return new org.springframework.data.domain.PageImpl<>(slice, pageable, all.size());
    }

    // ── Update ──────────────────────────────────────────────────────────────────

    @Transactional
    public ApplicationResponse update(UUID id, UUID userId, UpdateApplicationRequest req) {
        Application app = requireOwned(id, userId);

        if (req.company() != null) {
            app.setCompany(req.company().trim());
            app.setCompanyCanonical(Canonicalizer.canonicalize(req.company()));
        }
        if (req.role() != null) {
            app.setRole(req.role().trim());
            app.setRoleCanonical(Canonicalizer.canonicalize(req.role()));
        }
        if (req.appliedDate() != null) app.setAppliedDate(req.appliedDate());
        if (req.jobUrl()      != null) app.setJobUrl(req.jobUrl());
        if (req.notes()       != null) app.setNotes(req.notes());
        if (req.priority()    != null) app.setPriority(req.priority());
        if (req.recruiterName()  != null) app.setRecruiterName(req.recruiterName());
        if (req.recruiterEmail() != null) app.setRecruiterEmail(req.recruiterEmail());
        if (req.nextAction()     != null) app.setNextAction(req.nextAction());
        if (req.nextActionDue()  != null) app.setNextActionDue(req.nextActionDue());
        if (req.resumeId() != null) {
            app.setResume(requireOwnedResume(req.resumeId(), userId));
        }
        app.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));

        app = appRepo.save(app);
        scoreService.markStale(userId);
        return toResponse(app, false);
    }

    /**
     * Status transition: validates via StatusMachine, appends ONE timeline row.
     * Never overwrites existing timeline entries (FR-4.4).
     */
    @Transactional
    public ApplicationResponse updateStatus(UUID id, UUID userId, StatusUpdateRequest req) {
        Application app = requireOwned(id, userId);

        AppStatus newStatus = StatusMachine.parse(req.status());
        StatusMachine.validate(app.getCurrentStatus(), newStatus);

        app.setCurrentStatus(newStatus);

        // Auto-set next_action_due on return to applied (e.g., after ghosted correction)
        if (newStatus == AppStatus.applied && app.getNextActionDue() == null) {
            app.setNextActionDue(
                    app.getAppliedDate().atStartOfDay(ZoneOffset.UTC).toOffsetDateTime().plusDays(7));
        }
        app.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        app = appRepo.save(app);

        // Append — never overwrite — timeline (FR-4.4)
        appendTimeline(app, newStatus, req.notes(), "user");

        scoreService.markStale(userId);
        return toResponse(app, true);
    }

    // ── Soft-delete ─────────────────────────────────────────────────────────────

    @Transactional
    public void delete(UUID id, UUID userId) {
        int rows = appRepo.softDelete(id, userId, OffsetDateTime.now(ZoneOffset.UTC));
        if (rows == 0) {
            throw new NotFoundException("Application not found or already deleted");
        }
        // Don't mark stale — a deleted app actually improves the ratio, handled by score engine
    }

    // ── Outcomes ────────────────────────────────────────────────────────────────

    @Transactional
    public ApplicationOutcome recordOutcome(UUID id, UUID userId, OutcomeRequest req) {
        Application app = requireOwned(id, userId);

        // Snapshot current career score for anti-gaming / future weight tuning
        Integer scoreAtTime = scoreRepo.findByUserId(userId)
                .map(s -> s.getOverallScore())
                .orElse(0);

        ApplicationOutcome outcome = ApplicationOutcome.builder()
                .application(app)
                .user(userRepo.getReferenceById(userId))
                .outcome(req.outcome().trim().toLowerCase())
                .scoreAtTime(scoreAtTime)
                .recordedAt(OffsetDateTime.now(ZoneOffset.UTC))
                .build();

        outcome = outcomeRepo.save(outcome);
        scoreService.markStale(userId);
        return outcome;
    }

    // ── Analytics ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AnalyticsResponse analytics(UUID userId) {
        long total = appRepo.countByUserId(userId);
        if (total == 0) {
            return new AnalyticsResponse(0, 0.0, 0.0, Map.of(), Map.of());
        }

        long replied = appRepo.countRepliedByUserId(userId);
        long converted = appRepo.countConvertedByUserId(userId);

        Map<String, Long> stageCounts = new LinkedHashMap<>();
        for (Object[] row : appRepo.stageCountsByUserId(userId)) {
            stageCounts.put(((AppStatus) row[0]).name(), (Long) row[1]);
        }

        Map<String, Long> topCompanies = new LinkedHashMap<>();
        for (Object[] row : appRepo.topCompaniesByUserId(userId)) {
            topCompanies.put((String) row[0], ((Number) row[1]).longValue());
        }

        return new AnalyticsResponse(
                (int) total,
                round2((double) replied / total * 100),
                round2((double) converted / total * 100),
                stageCounts,
                topCompanies
        );
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private Application requireOwned(UUID id, UUID userId) {
        return appRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Application not found"));
    }

    /** Resolve a resume that belongs to the caller; rejects foreign resumeIds (IDOR). */
    private Resume requireOwnedResume(UUID resumeId, UUID userId) {
        return resumeRepo.findByIdAndUser_Id(resumeId, userId)
                .orElseThrow(() -> new NotFoundException("Resume not found"));
    }

    private void appendTimeline(Application app, AppStatus status, String notes, String createdBy) {
        ApplicationTimeline entry = ApplicationTimeline.builder()
                .application(app)
                .status(status)
                .notes(notes)
                .occurredAt(OffsetDateTime.now(ZoneOffset.UTC))
                .createdBy(createdBy)
                .build();
        timelineRepo.save(entry);
    }

    ApplicationResponse toResponse(Application a, boolean includeTimeline) {
        List<TimelineEntryResponse> timeline = includeTimeline
                ? timelineRepo.findByApplicationIdOrderByOccurredAtAsc(a.getId())
                        .stream().map(this::toTimelineEntry).toList()
                : null;

        return new ApplicationResponse(
                a.getId(),
                a.getCompany(),
                a.getCompanyCanonical(),
                a.getRole(),
                a.getRoleCanonical(),
                a.getSource() != null ? a.getSource().name() : null,
                a.getSourcePlatform(),
                a.getJobUrl(),
                a.getAppliedDate(),
                a.getResume() != null ? a.getResume().getId() : null,
                a.getCurrentStatus() != null ? a.getCurrentStatus().name() : null,
                a.getPriority(),
                a.getRecruiterName(),
                a.getRecruiterEmail(),
                a.getNextAction(),
                a.getNextActionDue(),
                a.getResponseLatencyDays(),
                a.getNotes(),
                a.getCreatedAt(),
                a.getUpdatedAt(),
                timeline
        );
    }

    private TimelineEntryResponse toTimelineEntry(ApplicationTimeline t) {
        return new TimelineEntryResponse(
                t.getId(),
                t.getStatus() != null ? t.getStatus().name() : null,
                t.getNotes(),
                t.getOccurredAt(),
                t.getCreatedBy()
        );
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
