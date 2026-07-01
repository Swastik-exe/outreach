package com.outreach.tracker.inbound;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.tracker.dto.CreateApplicationResult;
import com.outreach.tracker.inbound.dto.ConfirmDraftRequest;
import com.outreach.tracker.inbound.dto.InboundDraftResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inbound-email")
@RequiredArgsConstructor
public class InboundEmailController {

    private final InboundEmailDraftService draftService;

    @GetMapping("/drafts")
    public ResponseEntity<ApiResponse<List<InboundDraftResponse>>> listPending() {
        List<InboundDraftResponse> drafts = draftService.listPending(CurrentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(drafts));
    }

    @PostMapping("/drafts/{id}/confirm")
    public ResponseEntity<ApiResponse<CreateApplicationResult>> confirm(
            @PathVariable UUID id,
            @RequestBody(required = false) ConfirmDraftRequest overrides) {
        CreateApplicationResult result = draftService.confirm(id, CurrentUser.getUserId(), overrides);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/drafts/{id}/discard")
    public ResponseEntity<ApiResponse<Void>> discard(@PathVariable UUID id) {
        draftService.discard(id, CurrentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
