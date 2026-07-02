package com.outreach.tracker.inbound;

import com.outreach.common.exception.BadRequestException;
import com.outreach.common.exception.NotFoundException;
import com.outreach.tracker.ApplicationService;
import com.outreach.tracker.dto.CreateApplicationRequest;
import com.outreach.tracker.dto.CreateApplicationResult;
import com.outreach.tracker.inbound.dto.ConfirmDraftRequest;
import com.outreach.tracker.inbound.dto.InboundDraftResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InboundEmailDraftService {

    private static final BigDecimal REVIEW_THRESHOLD = new BigDecimal("0.6");

    private final InboundEmailDraftRepository draftRepo;
    private final ApplicationService          appService;

    // ── List pending drafts ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<InboundDraftResponse> listPending(UUID userId, Pageable pageable) {
        return draftRepo.findByUserIdAndStatusOrderByCreatedAtDesc(
                        userId, "pending_confirm", pageable)
                .map(this::toResponse);
    }

    // ── Confirm draft → create application ───────────────────────────────────

    /**
     * Confirms a draft with optional field overrides, then creates an Application
     * via ApplicationService (canonicalization + dedup apply).
     *
     * @return the ApplicationService result (which may include possibleDuplicate flag)
     */
    @Transactional
    public CreateApplicationResult confirm(UUID draftId, UUID userId,
                                          ConfirmDraftRequest overrides) {
        InboundEmailDraft draft = draftRepo.findByIdAndUserId(draftId, userId)
                .orElseThrow(() -> new NotFoundException("Draft not found"));

        if (!"pending_confirm".equals(draft.getStatus())) {
            throw new BadRequestException("Draft is already " + draft.getStatus());
        }

        // Apply optional overrides
        String    company     = coalesce(overrides != null ? overrides.company()     : null, draft.getParsedCompany());
        String    role        = coalesce(overrides != null ? overrides.role()        : null, draft.getParsedRole());
        LocalDate appliedDate = coalesce(overrides != null ? overrides.appliedDate() : null, draft.getParsedDate());

        if (company == null || company.isBlank()) throw new BadRequestException("Company is required to confirm this draft");
        if (role    == null || role.isBlank())    throw new BadRequestException("Role is required to confirm this draft");
        if (appliedDate == null)                  appliedDate = LocalDate.now();

        // Create application via Task-9 ApplicationService (dedup + canonicalization)
        CreateApplicationRequest req = new CreateApplicationRequest(
                company, role, "forwarded_email", appliedDate,
                null, null, null, null
        );

        CreateApplicationResult result = appService.create(userId, req, false);

        // Mark draft as confirmed
        draft.setStatus("confirmed");
        draft.setRawPayload(null);  // proactively clear PII on confirm
        draftRepo.save(draft);

        log.info("Draft {} confirmed → application created for user {}", draftId, userId);
        return result;
    }

    // ── Discard draft ─────────────────────────────────────────────────────────

    @Transactional
    public void discard(UUID draftId, UUID userId) {
        InboundEmailDraft draft = draftRepo.findByIdAndUserId(draftId, userId)
                .orElseThrow(() -> new NotFoundException("Draft not found"));

        if (!"pending_confirm".equals(draft.getStatus())) {
            throw new BadRequestException("Draft is already " + draft.getStatus());
        }

        draft.setStatus("discarded");
        draft.setRawPayload(null);  // proactively clear PII on discard
        draftRepo.save(draft);

        log.info("Draft {} discarded by user {}", draftId, userId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private InboundDraftResponse toResponse(InboundEmailDraft d) {
        return new InboundDraftResponse(
                d.getId(), d.getParsedCompany(), d.getParsedRole(), d.getParsedDate(),
                d.getConfidence(),
                d.getConfidence() != null && d.getConfidence().compareTo(REVIEW_THRESHOLD) < 0,
                d.getStatus(), d.getCreatedAt()
        );
    }

    private static <T> T coalesce(T first, T second) {
        return first != null ? first : second;
    }
}
