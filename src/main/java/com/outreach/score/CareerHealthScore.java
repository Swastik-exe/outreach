package com.outreach.score;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "career_health_scores")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CareerHealthScore {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    @Column(name = "overall_score")
    private Integer overallScore;

    @Column(name = "resume_score")
    private Integer resumeScore;

    @Column(name = "applications_score")
    private Integer applicationsScore;

    @Column(name = "skills_score")
    private Integer skillsScore;

    @Column(name = "profile_score")
    private Integer profileScore;

    @Column(name = "github_score")
    private Integer githubScore;

    /** CGPA is a component within the 1000 ceiling, not additive (D4). */
    @Column(name = "cgpa_component")
    private Integer cgpaComponent;

    @Column(name = "github_weight_redistributed")
    private Boolean githubWeightRedistributed;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "breakdown", columnDefinition = "jsonb")
    private String breakdown;

    @Column(name = "next_action", columnDefinition = "text")
    private String nextAction;

    @Column(name = "band", length = 30)
    private String band;

    @Column(name = "weekly_delta")
    private Integer weeklyDelta;

    /** Optimistic lock counter — service layer catches OptimisticLockException and retries (D10). */
    @Version
    @Column(name = "version")
    private Integer version;

    /** Dirty flag: set TRUE on any score-relevant data change; cleared by daily scoring job (D7). */
    @Column(name = "is_stale")
    private Boolean isStale;

    @Column(name = "last_computed_at")
    private OffsetDateTime lastComputedAt;
}
