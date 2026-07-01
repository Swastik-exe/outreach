package com.outreach.score;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "cohort_stats")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CohortStats {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "cohort_key", nullable = false, length = 160, unique = true)
    private String cohortKey;

    @Column(name = "cohort_size")
    private Integer cohortSize;

    @Column(name = "p25")
    private Integer p25;

    @Column(name = "p50")
    private Integer p50;

    @Column(name = "p75")
    private Integer p75;

    @Column(name = "p90")
    private Integer p90;

    /** Histogram JSON: {"0-100":3,"101-200":7,...} — enables exact percentile calculation (D2). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "score_histogram", columnDefinition = "jsonb")
    private String scoreHistogram;

    @Column(name = "computed_at")
    private OffsetDateTime computedAt;
}
