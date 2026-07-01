package com.outreach.ai;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_model_pricing",
       uniqueConstraints = @UniqueConstraint(columnNames = {"provider", "model", "effective_from"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AiModelPricing {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "provider", nullable = false, length = 40)
    private String provider;

    @Column(name = "model", nullable = false, length = 80)
    private String model;

    @Column(name = "input_per_1k_usd", nullable = false, precision = 10, scale = 6)
    private BigDecimal inputPer1kUsd;

    @Column(name = "output_per_1k_usd", nullable = false, precision = 10, scale = 6)
    private BigDecimal outputPer1kUsd;

    @Column(name = "effective_from")
    private OffsetDateTime effectiveFrom;
}
