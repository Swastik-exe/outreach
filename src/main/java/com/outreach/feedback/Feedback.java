package com.outreach.feedback;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "feedback")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** ON DELETE SET NULL — feedback outlives anonymous/deleted users for product learning. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "message", nullable = false, columnDefinition = "text")
    private String message;

    @Column(name = "screen", length = 120)
    private String screen;

    /** bug | feature */
    @Column(name = "type", length = 20)
    private String type;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
