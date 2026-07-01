package com.outreach.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AiInteractionRepository extends JpaRepository<AiInteraction, UUID> {
    List<AiInteraction> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<AiInteraction> findByUserIdAndCreatedAtAfter(UUID userId, OffsetDateTime since);

    @Query("""
            SELECT COALESCE(SUM(a.costUsd), 0)
            FROM AiInteraction a
            WHERE a.createdAt >= :start AND a.createdAt < :end
            """)
    BigDecimal sumCostBetween(@Param("start") OffsetDateTime start,
                              @Param("end") OffsetDateTime end);
}
