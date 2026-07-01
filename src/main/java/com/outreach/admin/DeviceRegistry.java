package com.outreach.admin;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "device_registry")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeviceRegistry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "fingerprint", nullable = false)
    private String fingerprint;

    /** ON DELETE SET NULL — device row survives user deletion for fraud detection continuity. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "account_count")
    private Integer accountCount;

    /** Set by fraud detection job; define downstream action when TRUE (H3). */
    @Column(name = "is_flagged")
    private Boolean isFlagged;

    @Column(name = "first_seen")
    private OffsetDateTime firstSeen;

    @Column(name = "last_seen")
    private OffsetDateTime lastSeen;
}
