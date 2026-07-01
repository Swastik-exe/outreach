package com.outreach.user;

import com.outreach.auth.AuthProvider;
import com.outreach.billing.PlanTier;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "auth_provider", nullable = false)
    private AuthProvider authProvider;

    @Column(name = "provider_id")
    private String providerId;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "plan_tier", nullable = false)
    private PlanTier planTier;

    @Column(name = "is_email_verified")
    private Boolean isEmailVerified;

    @Column(name = "is_suspended")
    private Boolean isSuspended;

    @Column(name = "trust_score")
    private Integer trustScore;

    @Column(name = "device_fingerprint")
    private String deviceFingerprint;

    @Column(name = "notif_channel", length = 20)
    private String notifChannel;

    @Column(name = "whatsapp_number", length = 20)
    private String whatsappNumber;

    @Column(name = "whatsapp_opt_in_at")
    private OffsetDateTime whatsappOptInAt;

    @Column(name = "consent_at")
    private OffsetDateTime consentAt;

    @Column(name = "ai_processing_consent_at")
    private OffsetDateTime aiProcessingConsentAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "last_active_at")
    private OffsetDateTime lastActiveAt;
}
