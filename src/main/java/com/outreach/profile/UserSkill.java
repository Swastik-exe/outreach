package com.outreach.profile;

import com.outreach.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "user_skills",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "skill_name"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;

    /** SMALLINT → Short; check (1–5) enforced at DB level. */
    @Column(name = "proficiency")
    private Short proficiency;

    /** self_reported | resume | github */
    @Column(name = "source", length = 40)
    private String source;
}
