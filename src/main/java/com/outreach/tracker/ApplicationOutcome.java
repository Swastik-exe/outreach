package com.outreach.tracker;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "application_outcomes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ApplicationOutcome {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /** interview_got | offer_got | rejected_after_interview */
    @Column(name = "outcome", length = 40)
    private String outcome;

    /** Snapshot of career score when this outcome was logged (FR-2.9). */
    @Column(name = "score_at_time")
    private Integer scoreAtTime;

    @Column(name = "recorded_at")
    private OffsetDateTime recordedAt;
}
