package com.outreach.resume;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.resume.dto.ResumeResponse;
import com.outreach.resume.dto.ResumeStatusResponse;
import com.outreach.resume.dto.UploadResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    /**
     * POST /api/v1/resumes/upload
     * PDF only, <= 5 MB.  Returns 202 while async analysis runs.
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<UploadResponse>> upload(
            @RequestParam("file") MultipartFile file) {
        UUID userId = CurrentUser.getUserId();
        UploadResponse result = resumeService.upload(userId, file);
        return ResponseEntity.accepted().body(ApiResponse.ok(result));
    }

    /**
     * GET /api/v1/resumes
     * List all resumes for the authenticated user, newest first.
     */
    @GetMapping
    public ApiResponse<List<ResumeResponse>> list() {
        return ApiResponse.ok(resumeService.listForUser(CurrentUser.getUserId()));
    }

    /**
     * GET /api/v1/resumes/{id}
     * Full resume details including analysis scores.
     */
    @GetMapping("/{id}")
    public ApiResponse<ResumeResponse> getById(@PathVariable UUID id) {
        return ApiResponse.ok(resumeService.getById(id, CurrentUser.getUserId()));
    }

    /**
     * GET /api/v1/resumes/{id}/status
     * Lightweight poll endpoint; returns only status fields.
     */
    @GetMapping("/{id}/status")
    public ApiResponse<ResumeStatusResponse> getStatus(@PathVariable UUID id) {
        return ApiResponse.ok(resumeService.getStatus(id, CurrentUser.getUserId()));
    }

    /**
     * POST /api/v1/resumes/{id}/analyze
     * On-demand (re-)analysis; subject to the same quota as upload-triggered analysis.
     */
    @PostMapping("/{id}/analyze")
    public ApiResponse<ResumeResponse> analyze(@PathVariable UUID id) {
        return ApiResponse.ok(resumeService.triggerAnalysis(id, CurrentUser.getUserId()));
    }

    /**
     * DELETE /api/v1/resumes/{id}
     * Marks the resume inactive (soft-delete — no deleted_at column in schema).
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        resumeService.delete(id, CurrentUser.getUserId());
        return ApiResponse.ok(null);
    }
}
