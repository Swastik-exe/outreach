package com.outreach.score;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "career_health_history",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "recorded_date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CareerHealthHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "overall_score")
    private Integer overallScore;

    /** PostgreSQL DATE → LocalDate (no time, no timezone). */
    @Column(name = "recorded_date", nullable = false)
    private LocalDate recordedDate;
}
