package com.outreach.feedback;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.feedback.dto.FeedbackResponse;
import com.outreach.feedback.dto.SubmitFeedbackRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<ApiResponse<FeedbackResponse>> submit(
            @Valid @RequestBody SubmitFeedbackRequest req) {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(feedbackService.submit(userId, req)));
    }
}
