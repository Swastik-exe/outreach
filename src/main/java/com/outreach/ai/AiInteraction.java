package com.outreach.ai;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_interactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AiInteraction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** ON DELETE SET NULL — interaction record survives user deletion for billing history. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "task_type", nullable = false, length = 80)
    private String taskType;

    @Column(name = "provider", length = 40)
    private String provider;

    @Column(name = "model", length = 80)
    private String model;

    @Column(name = "input_tokens")
    private Integer inputTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    /** Cost computed from ai_model_pricing at query time (F7). DECIMAL(10,6). */
    @Column(name = "cost_usd", precision = 10, scale = 6)
    private BigDecimal costUsd;

    @Column(name = "latency_ms")
    private Integer latencyMs;

    @Column(name = "cache_hit")
    private Boolean cacheHit;

    @Column(name = "success")
    private Boolean success;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
