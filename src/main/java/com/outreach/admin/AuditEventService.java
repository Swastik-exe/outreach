package com.outreach.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable audit trail for security-sensitive actions.
 * Writes to {@code user_events} in a separate transaction so audit failure
 * never rolls back the primary business operation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditEventService {

    public static final String LOGIN = "user.login";
    public static final String RESUME_UPLOAD = "resume.uploaded";
    public static final String USER_SUSPENDED = "admin.user_suspended";

    private final UserEventRepository userEventRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID userId, String eventName, Map<String, Object> properties) {
        try {
            User user = userId != null
                    ? userRepository.findById(userId).orElse(null)
                    : null;
            String propsJson = properties == null || properties.isEmpty()
                    ? null
                    : objectMapper.writeValueAsString(properties);

            userEventRepository.save(UserEvent.builder()
                    .user(user)
                    .eventName(eventName)
                    .properties(propsJson)
                    .createdAt(OffsetDateTime.now())
                    .build());
        } catch (JsonProcessingException e) {
            log.warn("Audit event JSON serialization failed for {}: {}", eventName, e.getMessage());
        } catch (Exception e) {
            log.warn("Failed to record audit event {} for user {}: {}", eventName, userId, e.getMessage());
        }
    }
}
