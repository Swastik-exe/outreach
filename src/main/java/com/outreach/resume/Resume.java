package com.outreach.resume;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "resumes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Resume {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "title")
    private String title;

    @Column(name = "version")
    private Integer version;

    @Column(name = "file_url", length = 500)
    private String fileUrl;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "raw_text", columnDefinition = "text")
    private String rawText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parsed_data", columnDefinition = "jsonb")
    private String parsedData;

    @Column(name = "target_role", length = 120)
    private String targetRole;

    @Column(name = "readiness_score")
    private Integer readinessScore;

    @Column(name = "keyword_score")
    private Integer keywordScore;

    @Column(name = "impact_score")
    private Integer impactScore;

    @Column(name = "formatting_score")
    private Integer formattingScore;

    /** PostgreSQL TEXT[] — mapped via ARRAY JDBC type. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "keyword_gaps", columnDefinition = "text[]")
    private String[] keywordGaps;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_fixes", columnDefinition = "jsonb")
    private String aiFixes;

    /** pending | processing | done | done_basic | failed */
    @Column(name = "analysis_status", length = 30)
    private String analysisStatus;

    /** ai | rule_based */
    @Column(name = "analysis_source", length = 20)
    private String analysisSource;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "analyzed_at")
    private OffsetDateTime analyzedAt;
}
