package com.outreach.tracker.inbound;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "inbound_email_drafts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InboundEmailDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /** Raw provider payload — TTL job purges this after confirm/discard (E3). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload", columnDefinition = "jsonb")
    private String rawPayload;

    @Column(name = "parsed_company")
    private String parsedCompany;

    @Column(name = "parsed_role")
    private String parsedRole;

    @Column(name = "parsed_date")
    private LocalDate parsedDate;

    /** AI parse confidence 0.000–1.000; values < 0.6 flag for manual review. */
    @Column(name = "confidence", precision = 4, scale = 3)
    private BigDecimal confidence;

    /** pending_confirm | confirmed | discarded */
    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
