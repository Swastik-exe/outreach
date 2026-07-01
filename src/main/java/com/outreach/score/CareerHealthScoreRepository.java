package com.outreach.score;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CareerHealthScoreRepository extends JpaRepository<CareerHealthScore, UUID> {
    Optional<CareerHealthScore> findByUserId(UUID userId);

    List<CareerHealthScore> findByIsStaleTrue();

    @Query("SELECT s FROM CareerHealthScore s JOIN FETCH s.user WHERE s.isStale = true")
    List<CareerHealthScore> findStaleWithUser();

    @Query("SELECT s.user.id, s.overallScore FROM CareerHealthScore s WHERE s.overallScore IS NOT NULL")
    List<Object[]> findAllUserScoresForSnapshot();
}
