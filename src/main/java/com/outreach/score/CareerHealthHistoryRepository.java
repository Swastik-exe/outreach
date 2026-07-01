package com.outreach.score;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CareerHealthHistoryRepository extends JpaRepository<CareerHealthHistory, UUID> {

    List<CareerHealthHistory> findByUserIdOrderByRecordedDateDesc(UUID userId);

    Optional<CareerHealthHistory> findByUserIdAndRecordedDate(UUID userId, LocalDate recordedDate);

    /** 90-day window used by the history endpoint. */
    List<CareerHealthHistory> findByUserIdAndRecordedDateGreaterThanEqualOrderByRecordedDateAsc(
            UUID userId, LocalDate since);

    Page<CareerHealthHistory> findByUserIdAndRecordedDateGreaterThanEqualOrderByRecordedDateAsc(
            UUID userId, LocalDate since, Pageable pageable);

    /**
     * Idempotent daily snapshot — safe to re-run: same-day re-run updates the score.
     * Uses PostgreSQL's ON CONFLICT DO UPDATE to avoid unique-constraint errors.
     */
    @Modifying
    @Query(nativeQuery = true, value = """
            INSERT INTO career_health_history (id, user_id, overall_score, recorded_date)
            VALUES (gen_random_uuid(), :userId, :overallScore, :recordedDate)
            ON CONFLICT (user_id, recorded_date) DO UPDATE SET overall_score = EXCLUDED.overall_score
            """)
    void upsertHistory(@Param("userId") UUID userId,
                       @Param("overallScore") int overallScore,
                       @Param("recordedDate") LocalDate recordedDate);
}
