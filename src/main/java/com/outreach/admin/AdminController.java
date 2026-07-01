package com.outreach.admin;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.admin.dto.AdminFeedbackItem;
import com.outreach.admin.dto.AdminStatsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminStatsResponse>> stats() {
        UUID adminId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(adminService.getStats(adminId)));
    }

    @GetMapping("/feedback")
    public ResponseEntity<ApiResponse<Page<AdminFeedbackItem>>> feedback(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID adminId = CurrentUser.getUserId();
        int safeSize = Math.min(Math.max(size, 1), 100);
        Page<AdminFeedbackItem> result = adminService.listFeedback(
                adminId, PageRequest.of(Math.max(page, 0), safeSize));
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> suspend(@PathVariable UUID id) {
        UUID adminId = CurrentUser.getUserId();
        adminService.suspendUser(adminId, id);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("suspended", true)));
    }
}
