package com.outreach.billing;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.billing.dto.CheckoutRequest;
import com.outreach.billing.dto.CheckoutResponse;
import com.outreach.billing.dto.SubscriptionInfoResponse;
import com.outreach.billing.dto.UsageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/subscription")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;
    private final PlanConfig planConfig;

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<CheckoutResponse>> checkout(
            @Valid @RequestBody CheckoutRequest req) {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                subscriptionService.checkout(userId, req.plan())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<SubscriptionInfoResponse>> current() {
        return ResponseEntity.ok(ApiResponse.ok(
                subscriptionService.getSubscriptionInfo(CurrentUser.getUserId())));
    }

    @GetMapping("/usage")
    public ResponseEntity<ApiResponse<UsageResponse>> usage() {
        return ResponseEntity.ok(ApiResponse.ok(
                subscriptionService.getUsage(CurrentUser.getUserId())));
    }

    /** Public pricing for the frontend (no auth required values only). */
    @GetMapping("/pricing")
    public ResponseEntity<ApiResponse<Map<String, Object>>> pricing() {
        return ResponseEntity.ok(ApiResponse.ok(planConfig.publicPricing()));
    }
}
