package com.outreach.notification;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "type", nullable = false, length = 80)
    private String type;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "body", nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "cta_url", length = 500)
    private String ctaUrl;

    @Column(name = "is_read")
    private Boolean isRead;

    /** PostgreSQL TEXT[] — delivery channel list; e.g. {in_app, email}. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "channels", columnDefinition = "text[]")
    private String[] channels;

    /** pending | sent | failed | no_channel */
    @Column(name = "delivery_status", length = 20)
    private String deliveryStatus;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
