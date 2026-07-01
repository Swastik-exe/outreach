package com.outreach.resume;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResumeRepository extends JpaRepository<Resume, UUID> {

    List<Resume> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<Resume> findByUserIdAndIsActiveTrue(UUID userId);

    /**
     * Deactivates all active resumes for a user EXCEPT the given one.
     * Called in the same transaction as activating the new resume to
     * satisfy the partial unique index on (user_id) WHERE is_active = true.
     */
    @Modifying
    @Query("""
            UPDATE Resume r SET r.isActive = false
            WHERE r.user.id = :userId
              AND r.isActive = true
              AND r.id != :excludeId
            """)
    void deactivateAllExcept(@Param("userId") UUID userId, @Param("excludeId") UUID excludeId);
}
