package com.outreach.notification;

import com.outreach.auth.EmailNotificationService;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Central notification service.
 *
 * Channel resolution rules (C3):
 *   - in_app is always included (it's a DB row — never fails).
 *   - If notif_channel = 'whatsapp': add whatsapp channel IF the user has a
 *     verified whatsapp_number (whatsapp_opt_in_at IS NOT NULL). If the channel
 *     is whatsapp but opt-in is missing, set delivery_status='no_channel' and
 *     surface it — NEVER silently skip.
 *   - Otherwise (in_app / email): add email channel and send via EmailService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notifRepo;
    private final UserRepository userRepo;
    private final EmailNotificationService emailService;
    private final WhatsAppService whatsAppService;

    // ── Create + dispatch ─────────────────────────────────────────────────────

    /**
     * Creates a notification row and dispatches to resolved channels.
     * Always returns the persisted notification (even if delivery is no_channel).
     */
    @Transactional
    public Notification create(UUID userId, String type, String title,
                               String body, String ctaUrl) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        return create(user, type, title, body, ctaUrl);
    }

    @Transactional
    public Notification create(User user, String type, String title,
                               String body, String ctaUrl) {
        List<String> channels = new ArrayList<>();
        channels.add("in_app");

        String deliveryStatus = "pending";
        String channel = user.getNotifChannel() != null ? user.getNotifChannel() : "in_app";

        if ("whatsapp".equals(channel)) {
            boolean hasValidWhatsApp = user.getWhatsappNumber() != null
                    && !user.getWhatsappNumber().isBlank()
                    && user.getWhatsappOptInAt() != null;

            if (hasValidWhatsApp) {
                channels.add("whatsapp");
            } else {
                // C3: no valid channel — surface explicitly, never skip silently
                log.warn("User {} has notif_channel=whatsapp but no verified number — no_channel",
                        user.getId());
                deliveryStatus = "no_channel";
            }
        } else {
            // default: in_app + email
            channels.add("email");
        }

        Notification notif = Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .body(body)
                .ctaUrl(ctaUrl)
                .isRead(false)
                .channels(channels.toArray(new String[0]))
                .deliveryStatus(deliveryStatus)
                .createdAt(OffsetDateTime.now())
                .build();

        notif = notifRepo.save(notif);

        // Dispatch — fire-and-forget; delivery failures do not roll back the row
        if (!"no_channel".equals(deliveryStatus)) {
            dispatch(notif, user, channels);
        }

        return notif;
    }

    // ── Mark read ─────────────────────────────────────────────────────────────

    @Transactional
    public void markRead(UUID notifId, UUID userId) {
        notifRepo.findById(notifId).ifPresent(n -> {
            if (n.getUser().getId().equals(userId)) {
                n.setIsRead(true);
                notifRepo.save(n);
            }
        });
    }

    @Transactional
    public void markAllRead(UUID userId) {
        List<Notification> unread = notifRepo.findByUserIdAndIsReadFalse(userId);
        unread.forEach(n -> n.setIsRead(true));
        notifRepo.saveAll(unread);
    }

    // ── Fetch ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<Notification> list(UUID userId, org.springframework.data.domain.Pageable pageable) {
        return notifRepo.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    @Transactional(readOnly = true)
    public List<Notification> list(UUID userId) {
        return notifRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ── Preferences ───────────────────────────────────────────────────────────

    @Transactional
    public void updatePreferences(UUID userId, String channel) {
        userRepo.findById(userId).ifPresent(user -> {
            user.setNotifChannel(channel);
            userRepo.save(user);
        });
    }

    // ── Private dispatch ──────────────────────────────────────────────────────

    private void dispatch(Notification notif, User user, List<String> channels) {
        boolean success = true;

        if (channels.contains("email")) {
            try {
                emailService.sendEmail(
                        user.getEmail(),
                        notif.getTitle(),
                        "<p>" + notif.getBody() + "</p>" +
                        (notif.getCtaUrl() != null
                                ? "<p><a href=\"" + notif.getCtaUrl() + "\">View Details</a></p>"
                                : "")
                );
            } catch (Exception e) {
                log.warn("Email dispatch failed for notif {}: {}", notif.getId(), e.getMessage());
                success = false;
            }
        }

        if (channels.contains("whatsapp")) {
            try {
                boolean sent = whatsAppService.send(user.getWhatsappNumber(), notif.getBody());
                if (!sent) success = false;
            } catch (Exception e) {
                log.warn("WhatsApp dispatch failed for notif {}: {}", notif.getId(), e.getMessage());
                success = false;
            }
        }

        String status = success ? "sent" : "failed";
        notif.setDeliveryStatus(status);
        notifRepo.save(notif);
    }
}
