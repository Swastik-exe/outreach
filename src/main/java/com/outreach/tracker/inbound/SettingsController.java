package com.outreach.tracker.inbound;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.tracker.inbound.dto.ForwardingAddressResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final ForwardingAddressService forwardingService;

    /**
     * Returns the user's forwarding address (creates one lazily if not yet issued).
     */
    @GetMapping("/forwarding")
    public ResponseEntity<ApiResponse<ForwardingAddressResponse>> getForwardingAddress() {
        ForwardingAddress fa = forwardingService.getOrCreate(CurrentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(toResponse(fa)));
    }

    private ForwardingAddressResponse toResponse(ForwardingAddress fa) {
        return new ForwardingAddressResponse(fa.getId(), fa.getAddress(), fa.getCreatedAt());
    }
}
