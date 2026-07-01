package com.outreach.billing;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "plan", nullable = false)
    private PlanTier plan;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "status", nullable = false)
    private SubStatus status;

    @Column(name = "is_season_pass")
    private Boolean isSeasonPass;

    @Column(name = "amount_inr")
    private Integer amountInr;

    /** One-time Season Pass uses this + payment ID (C6). */
    @Column(name = "razorpay_order_id")
    private String razorpayOrderId;

    /** Recurring subscription uses this (C6). */
    @Column(name = "razorpay_subscription_id")
    private String razorpaySubscriptionId;

    @Column(name = "razorpay_customer_id")
    private String razorpayCustomerId;

    @Column(name = "period_start")
    private OffsetDateTime periodStart;

    /** Expiry is lazy — compare period_end to now() on access (D13). */
    @Column(name = "period_end")
    private OffsetDateTime periodEnd;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
