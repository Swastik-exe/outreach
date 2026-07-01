package com.outreach.tracker;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.common.PageParams;
import com.outreach.tracker.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService appService;

    @PostMapping
    public ApiResponse<CreateApplicationResult> create(
            @Valid @RequestBody CreateApplicationRequest req,
            @RequestParam(defaultValue = "false") boolean force) {
        UUID userId = CurrentUser.getUserId();
        CreateApplicationResult result = appService.create(userId, req, force);
        return ApiResponse.ok(result);
    }

    @GetMapping
    public ApiResponse<Page<ApplicationResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<ApplicationResponse> result = appService.list(
                CurrentUser.getUserId(), status,
                PageRequest.of(PageParams.safePage(page), PageParams.safeSize(size)));
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<ApplicationResponse> getById(@PathVariable UUID id) {
        return ApiResponse.ok(appService.getById(id, CurrentUser.getUserId()));
    }

    @PutMapping("/{id}")
    public ApiResponse<ApplicationResponse> update(
            @PathVariable UUID id,
            @RequestBody UpdateApplicationRequest req) {
        return ApiResponse.ok(appService.update(id, CurrentUser.getUserId(), req));
    }

    @PutMapping("/{id}/status")
    public ApiResponse<ApplicationResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody StatusUpdateRequest req) {
        return ApiResponse.ok(appService.updateStatus(id, CurrentUser.getUserId(), req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        appService.delete(id, CurrentUser.getUserId());
        return ApiResponse.ok(null);
    }

    @GetMapping("/{id}/timeline")
    public ApiResponse<Page<TimelineEntryResponse>> timeline(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ApiResponse.ok(appService.getTimeline(
                id, CurrentUser.getUserId(),
                PageRequest.of(PageParams.safePage(page), PageParams.safeSize(size))));
    }

    @GetMapping("/analytics")
    public ApiResponse<AnalyticsResponse> analytics() {
        return ApiResponse.ok(appService.analytics(CurrentUser.getUserId()));
    }

    @GetMapping("/follow-ups")
    public ApiResponse<Page<ApplicationResponse>> followUps(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(appService.getFollowUpsDue(
                CurrentUser.getUserId(),
                PageRequest.of(PageParams.safePage(page), PageParams.safeSize(size))));
    }

    @PostMapping("/{id}/outcome")
    public ApiResponse<Void> recordOutcome(
            @PathVariable UUID id,
            @Valid @RequestBody OutcomeRequest req) {
        appService.recordOutcome(id, CurrentUser.getUserId(), req);
        return ApiResponse.ok(null);
    }
}
