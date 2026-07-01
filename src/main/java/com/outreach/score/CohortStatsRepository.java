package com.outreach.score;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CohortStatsRepository extends JpaRepository<CohortStats, UUID> {
    Optional<CohortStats> findByCohortKey(String cohortKey);
}
