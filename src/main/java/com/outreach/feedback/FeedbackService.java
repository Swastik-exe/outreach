package com.outreach.feedback;

import com.outreach.common.exception.BadRequestException;
import com.outreach.feedback.dto.FeedbackResponse;
import com.outreach.feedback.dto.SubmitFeedbackRequest;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    @Transactional
    public FeedbackResponse submit(UUID userId, SubmitFeedbackRequest req) {
        if (req.getMessage() == null || req.getMessage().isBlank()) {
            throw new BadRequestException("Message is required");
        }
        String type = req.getType() != null ? req.getType() : "bug";
        if (!type.equals("bug") && !type.equals("feature")) {
            throw new BadRequestException("type must be bug or feature");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException("User not found"));

        String screen = sanitize(req.getScreen(), 120);
        String message = sanitize(req.getMessage(), 5000);

        Feedback fb = Feedback.builder()
                .user(user)
                .message(message)
                .screen(screen)
                .type(type)
                .createdAt(OffsetDateTime.now())
                .build();

        fb = feedbackRepository.save(fb);
        return toResponse(fb);
    }

    private static String sanitize(String val, int max) {
        if (val == null) return null;
        String trimmed = val.trim();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }

    static FeedbackResponse toResponse(Feedback fb) {
        return FeedbackResponse.builder()
                .id(fb.getId())
                .message(fb.getMessage())
                .screen(fb.getScreen())
                .type(fb.getType())
                .createdAt(fb.getCreatedAt())
                .build();
    }
}
