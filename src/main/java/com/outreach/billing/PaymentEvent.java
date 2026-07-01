package com.outreach.billing;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payment_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** ON DELETE SET NULL — event row survives account deletion for audit trail. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "event_type", length = 80)
    private String eventType;

    /** Idempotency guard: webhook signature verified BEFORE insert; unique stops double-activation (D15). */
    @Column(name = "provider_event_id", unique = true)
    private String providerEventId;

    @Column(name = "amount_inr")
    private Integer amountInr;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
