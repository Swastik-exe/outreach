package com.outreach.score;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.util.List;

/** Read-only queries for cohort aggregation (no entity root). */
public interface CohortDataRepository extends Repository<CohortStats, java.util.UUID> {

    @Query(value = """
            SELECT up.cohort_key, chs.overall_score
            FROM user_profiles up
            INNER JOIN career_health_scores chs ON chs.user_id = up.user_id
            WHERE up.cohort_key IS NOT NULL
              AND chs.overall_score IS NOT NULL
            """, nativeQuery = true)
    List<Object[]> findAllCohortScores();
}
