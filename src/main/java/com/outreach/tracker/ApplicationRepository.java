package com.outreach.tracker;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    List<Application> findByUserId(UUID userId);

    @EntityGraph(attributePaths = "resume")
    Page<Application> findByUserIdOrderByAppliedDateDesc(UUID userId, Pageable pageable);

    @EntityGraph(attributePaths = "resume")
    Page<Application> findByUserIdAndCurrentStatusOrderByAppliedDateDesc(
            UUID userId, AppStatus status, Pageable pageable);

    List<Application> findByUserIdOrderByAppliedDateDesc(UUID userId);

    List<Application> findByUserIdAndCurrentStatusOrderByAppliedDateDesc(UUID userId, AppStatus status);

    @Query(value = """
            SELECT * FROM applications
            WHERE user_id = :userId
              AND deleted_at IS NULL
              AND similarity(company_canonical, :company) > 0.5
              AND ABS(applied_date - CAST(:appliedDate AS DATE)) <= 2
            LIMIT 1
            """, nativeQuery = true)
    Optional<Application> findFuzzyDuplicate(
            @Param("userId") UUID userId,
            @Param("company") String company,
            @Param("appliedDate") LocalDate appliedDate);

    @EntityGraph(attributePaths = "resume")
    @Query("""
            SELECT a FROM Application a
            WHERE a.user.id = :userId
              AND a.currentStatus = com.outreach.tracker.AppStatus.applied
              AND a.nextActionDue IS NOT NULL
              AND a.nextActionDue < :now
            ORDER BY a.nextActionDue ASC
            """)
    List<Application> findFollowUpsDue(@Param("userId") UUID userId,
                                       @Param("now") OffsetDateTime now);

    @Query(value = """
            SELECT * FROM applications
            WHERE deleted_at IS NULL
              AND current_status = 'applied'
              AND next_action_due IS NOT NULL
              AND next_action_due < :now
            ORDER BY next_action_due ASC
            """, nativeQuery = true)
    List<Application> findAllFollowUpsDue(@Param("now") OffsetDateTime now);

    @Modifying
    @Query("UPDATE Application a SET a.deletedAt = :now WHERE a.id = :id AND a.user.id = :userId")
    int softDelete(@Param("id") UUID id,
                   @Param("userId") UUID userId,
                   @Param("now") OffsetDateTime now);

    @EntityGraph(attributePaths = "resume")
    Optional<Application> findByIdAndUserId(UUID id, UUID userId);

    @Query(value = "SELECT * FROM applications WHERE id = :id", nativeQuery = true)
    Optional<Application> findByIdUnfiltered(@Param("id") UUID id);

    // ── DB-side analytics (Section 1) ───────────────────────────────────────

    @Query("SELECT COUNT(a) FROM Application a WHERE a.user.id = :userId")
    long countByUserId(@Param("userId") UUID userId);

    @Query("""
            SELECT COUNT(a) FROM Application a
            WHERE a.user.id = :userId AND a.currentStatus <> com.outreach.tracker.AppStatus.applied
            """)
    long countRepliedByUserId(@Param("userId") UUID userId);

    @Query("""
            SELECT COUNT(a) FROM Application a
            WHERE a.user.id = :userId
              AND a.currentStatus IN (
                com.outreach.tracker.AppStatus.offer_received,
                com.outreach.tracker.AppStatus.offer_accepted,
                com.outreach.tracker.AppStatus.offer_declined)
            """)
    long countConvertedByUserId(@Param("userId") UUID userId);

    @Query("""
            SELECT a.currentStatus, COUNT(a) FROM Application a
            WHERE a.user.id = :userId
            GROUP BY a.currentStatus
            """)
    List<Object[]> stageCountsByUserId(@Param("userId") UUID userId);

    @Query(value = """
            SELECT company_canonical, COUNT(*) AS cnt FROM applications
            WHERE user_id = :userId AND deleted_at IS NULL
            GROUP BY company_canonical
            ORDER BY cnt DESC
            LIMIT 5
            """, nativeQuery = true)
    List<Object[]> topCompaniesByUserId(@Param("userId") UUID userId);
}
