package com.outreach.billing;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "usage_quotas",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "metric"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UsageQuota {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /** e.g. resume_analyses, ai_chat_messages */
    @Column(name = "metric", nullable = false, length = 80)
    private String metric;

    @Column(name = "used")
    private Integer used;

    @Column(name = "quota_limit", nullable = false)
    private Integer quotaLimit;

    /** Single source of truth for reset timing; rolled forward on lazy reset (D14). */
    @Column(name = "resets_at", nullable = false)
    private OffsetDateTime resetsAt;
}
