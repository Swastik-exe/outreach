package com.outreach.tracker;

import com.outreach.resume.Resume;
import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Soft-deleted via deleted_at. @SQLRestriction ensures every JPA query
 * automatically excludes deleted rows — no WHERE clause needed in callers (C4).
 */
@Entity
@Table(name = "applications")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "company", nullable = false)
    private String company;

    @Column(name = "company_canonical", nullable = false)
    private String companyCanonical;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "role_canonical", nullable = false)
    private String roleCanonical;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "source")
    private AppSource source;

    @Column(name = "source_platform", length = 120)
    private String sourcePlatform;

    @Column(name = "job_url", length = 500)
    private String jobUrl;

    @Column(name = "applied_date", nullable = false)
    private LocalDate appliedDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id")
    private Resume resume;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "current_status")
    private AppStatus currentStatus;

    @Column(name = "priority", length = 10)
    private String priority;

    @Column(name = "recruiter_name")
    private String recruiterName;

    @Column(name = "recruiter_email")
    private String recruiterEmail;

    @Column(name = "next_action", columnDefinition = "text")
    private String nextAction;

    @Column(name = "next_action_due")
    private OffsetDateTime nextActionDue;

    @Column(name = "response_latency_days")
    private Integer responseLatencyDays;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    /** Soft-delete timestamp; filtered from all default queries by @SQLRestriction. */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
