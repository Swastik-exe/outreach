package com.outreach.notification;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.common.PageParams;
import com.outreach.notification.dto.NotificationResponse;
import com.outreach.notification.dto.PreferencesRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notifService;

    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse<Page<NotificationResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = CurrentUser.getUserId();
        Page<NotificationResponse> result = notifService.list(
                        userId, PageRequest.of(PageParams.safePage(page), PageParams.safeSize(size)))
                .map(this::toResponse);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PutMapping("/notifications/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable UUID id) {
        notifService.markRead(id, CurrentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PutMapping("/notifications/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllRead() {
        notifService.markAllRead(CurrentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PutMapping("/notifications/preferences")
    public ResponseEntity<ApiResponse<Void>> updatePreferences(
            @Valid @RequestBody PreferencesRequest req) {
        notifService.updatePreferences(CurrentUser.getUserId(), req.channel());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    private NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(), n.getType(), n.getTitle(), n.getBody(),
                n.getCtaUrl(), Boolean.TRUE.equals(n.getIsRead()),
                n.getChannels(), n.getDeliveryStatus(), n.getCreatedAt()
        );
    }
}
