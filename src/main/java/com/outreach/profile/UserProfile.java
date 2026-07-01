package com.outreach.profile;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "target_role", length = 120)
    private String targetRole;

    @Column(name = "target_domain", length = 120)
    private String targetDomain;

    @Column(name = "cohort_key", length = 160)
    private String cohortKey;

    @Column(name = "graduation_year")
    private Integer graduationYear;

    @Column(name = "college_name")
    private String collegeName;

    @Column(name = "branch", length = 120)
    private String branch;

    @Column(name = "cgpa", precision = 4, scale = 2)
    private BigDecimal cgpa;

    @Column(name = "github_username", length = 120)
    private String githubUsername;

    @Column(name = "linkedin_url", length = 400)
    private String linkedinUrl;

    @Column(name = "location", length = 160)
    private String location;

    @Column(name = "github_connected")
    private Boolean githubConnected;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "github_data", columnDefinition = "jsonb")
    private String githubData;

    @Column(name = "github_last_fetched")
    private OffsetDateTime githubLastFetched;

    @Column(name = "profile_completeness_pct")
    private Integer profileCompletenessPct;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
