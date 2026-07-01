package com.outreach.tracker;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLEnumJdbcType;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "application_timeline")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ApplicationTimeline {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private Application application;

    @Enumerated(EnumType.STRING)
    @JdbcType(PostgreSQLEnumJdbcType.class)
    @Column(name = "status", nullable = false)
    private AppStatus status;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "occurred_at")
    private OffsetDateTime occurredAt;

    /** user | system */
    @Column(name = "created_by", length = 20)
    private String createdBy;
}
