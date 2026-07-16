package com.outreach.resume;

import com.outreach.admin.AuditEventService;
import com.outreach.common.PdfValidation;
import com.outreach.common.exception.BadRequestException;
import com.outreach.common.exception.ForbiddenException;
import com.outreach.common.exception.NotFoundException;
import com.outreach.resume.dto.ResumeResponse;
import com.outreach.resume.dto.ResumeStatusResponse;
import com.outreach.resume.dto.UploadResponse;
import com.outreach.resume.storage.FileStorage;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeService {

    private static final long   MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
    private static final String PDF_TYPE       = "application/pdf";

    private final ResumeRepository       resumeRepo;
    private final UserRepository         userRepo;
    private final FileStorage            fileStorage;
    private final ResumeParser           resumeParser;
    private final ResumeAnalysisService  analysisService;
    private final AuditEventService      auditEventService;

    // -------------------------------------------------------------------------
    // Upload
    // -------------------------------------------------------------------------

    @Transactional
    public UploadResponse upload(UUID userId, MultipartFile file) {
        // --- Validate ---
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file provided");
        }
        String contentType = file.getContentType();
        if (!PDF_TYPE.equalsIgnoreCase(contentType)) {
            throw new BadRequestException(
                    "Only PDF files are accepted. Received: " + (contentType != null ? contentType : "unknown"));
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BadRequestException("File too large. Maximum allowed size is 5 MB.");
        }

        User user = userRepo.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        // --- Store file ---
        String key = "resumes/" + userId + "/" + UUID.randomUUID() + ".pdf";
        String fileUrl;
        byte[] bytes;
        try {
            bytes = file.getBytes();
            PdfValidation.requirePdfMagicBytes(bytes);
            fileUrl = fileStorage.store(key, bytes, PDF_TYPE);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store resume file", e);
        }

        // --- Determine next version number ---
        int nextVersion = resumeRepo.findByUserIdOrderByCreatedAtDesc(userId).size() + 1;

        // --- Create resume row (status = processing) ---
        Resume resume = Resume.builder()
                .user(user)
                .title("Resume v" + nextVersion)
                .version(nextVersion)
                .fileName(file.getOriginalFilename())
                .fileUrl(fileUrl)
                .analysisStatus("processing")
                .isActive(false)
                .createdAt(OffsetDateTime.now())
                .build();
        resume = resumeRepo.save(resume);

        // --- Parse text (blocking, bounded by Tika timeout) ---
        ResumeParser.ParseResult parseResult;
        try {
            parseResult = resumeParser.parse(file.getInputStream());
        } catch (IOException e) {
            resume.setAnalysisStatus("failed");
            resumeRepo.save(resume);
            return new UploadResponse(resume.getId(), resume.getFileName(),
                    "failed", "Could not read file stream");
        }

        if (!parseResult.isSuccess()) {
            resume.setAnalysisStatus("failed");
            resumeRepo.save(resume);
            return new UploadResponse(resume.getId(), resume.getFileName(),
                    "failed", parseResult.errorMessage() != null
                    ? parseResult.errorMessage() : "PDF could not be parsed");
        }

        resume.setRawText(parseResult.text());

        // --- Deactivate previous active resume FIRST, THEN activate new one ---
        // Order matters: the partial unique index fires if two rows are active at once.
        resumeRepo.deactivateAllExcept(userId, resume.getId());
        resume.setIsActive(true);
        resume = resumeRepo.save(resume);

        // --- Trigger async analysis AFTER this transaction commits ---
        // Must fire after commit so the async thread sees rawText in the DB.
        final UUID resumeId = resume.getId();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                analysisService.analyzeAsync(resumeId, userId);
            }
        });

        auditEventService.record(userId, AuditEventService.RESUME_UPLOAD, java.util.Map.of(
                "resumeId", resume.getId().toString(),
                "fileName", resume.getFileName() != null ? resume.getFileName() : "",
                "sizeBytes", file.getSize()));

        return new UploadResponse(resume.getId(), resume.getFileName(),
                "processing", "Resume uploaded and queued for analysis");
    }

    // -------------------------------------------------------------------------
    // Query
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<ResumeResponse> listForUser(UUID userId, Pageable pageable) {
        return resumeRepo.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ResumeResponse getById(UUID resumeId, UUID userId) {
        Resume resume = findOwned(resumeId, userId);
        return toResponse(resume);
    }

    @Transactional(readOnly = true)
    public ResumeStatusResponse getStatus(UUID resumeId, UUID userId) {
        Resume resume = findOwned(resumeId, userId);
        return new ResumeStatusResponse(resume.getId(), resume.getAnalysisStatus(),
                resume.getAnalysisSource(), statusMessage(resume.getAnalysisStatus()));
    }

    // -------------------------------------------------------------------------
    // On-demand analysis
    // -------------------------------------------------------------------------

    @Transactional
    public ResumeResponse triggerAnalysis(UUID resumeId, UUID userId) {
        Resume resume = findOwned(resumeId, userId);
        if (resume.getRawText() == null || resume.getRawText().isBlank()) {
            throw new BadRequestException("Resume text could not be extracted — cannot analyse.");
        }
        Resume analysed = analysisService.analyze(resume, userId);
        return toResponse(analysed);
    }

    // -------------------------------------------------------------------------
    // Delete (soft via is_active = false; hard delete of file not yet wired)
    // -------------------------------------------------------------------------

    @Transactional
    public void delete(UUID resumeId, UUID userId) {
        Resume resume = findOwned(resumeId, userId);
        // Soft-delete: mark inactive (no deleted_at column in resumes table)
        resume.setIsActive(false);
        resumeRepo.save(resume);
    }

    private Resume findOwned(UUID resumeId, UUID userId) {
        Resume resume = resumeRepo.findById(resumeId)
                .orElseThrow(() -> new NotFoundException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new ForbiddenException("Access denied");
        }
        return resume;
    }

    private ResumeResponse toResponse(Resume resume) {
        return new ResumeResponse(
                resume.getId(),
                resume.getTitle(),
                resume.getVersion(),
                resume.getFileName(),
                resume.getTargetRole(),
                resume.getReadinessScore(),
                resume.getKeywordScore(),
                resume.getImpactScore(),
                resume.getFormattingScore(),
                resume.getKeywordGaps() != null ? Arrays.asList(resume.getKeywordGaps()) : List.of(),
                resume.getAiFixes(),
                resume.getAnalysisStatus(),
                resume.getAnalysisSource(),
                Boolean.TRUE.equals(resume.getIsActive()),
                resume.getCreatedAt(),
                resume.getAnalyzedAt()
        );
    }

    private String statusMessage(String status) {
        return switch (status != null ? status : "") {
            case "done"       -> "Analysis complete (AI-powered readiness signals).";
            case "done_basic" -> "Basic analysis complete. AI analysis will run when keys are configured.";
            case "processing" -> "Analysis in progress. Refresh in a moment.";
            case "failed"     -> "Analysis failed. Please re-upload or contact support.";
            default           -> "Status unknown.";
        };
    }
}
