package com.outreach.tracker.inbound;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "forwarding_addresses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ForwardingAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    /** Long random token (E5): app-generated base32, never guessable. */
    @Column(name = "address", nullable = false, unique = true)
    private String address;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
