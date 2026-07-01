package com.outreach.billing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UsageQuotaRepository extends JpaRepository<UsageQuota, UUID> {

    List<UsageQuota> findByUserId(UUID userId);

    Optional<UsageQuota> findByUserIdAndMetric(UUID userId, String metric);

    /**
     * Atomic increment: only updates if used < quota_limit AND not expired.
     * Returns 1 if incremented, 0 if quota exceeded or row missing.
     */
    @Modifying
    @Query("""
            UPDATE UsageQuota q SET q.used = q.used + 1
            WHERE q.user.id = :userId
              AND q.metric   = :metric
              AND q.used     < q.quotaLimit
              AND q.resetsAt > :now
            """)
    int atomicIncrement(@Param("userId") UUID userId,
                        @Param("metric") String metric,
                        @Param("now") OffsetDateTime now);

    /**
     * Refund one use (on hard failure). Prevents used from going below zero.
     */
    @Modifying
    @Query("""
            UPDATE UsageQuota q SET q.used = GREATEST(0, q.used - 1)
            WHERE q.user.id = :userId
              AND q.metric   = :metric
            """)
    void atomicDecrement(@Param("userId") UUID userId, @Param("metric") String metric);

    /**
     * Upsert the quota row so atomicIncrement always has a row to act on.
     * Uses native SQL ON CONFLICT so concurrent inserts are safe.
     */
    @Modifying
    @Query(value = """
            INSERT INTO usage_quotas (id, user_id, metric, used, quota_limit, resets_at)
            VALUES (gen_random_uuid(), :userId, :metric, 0, :limit, :resetsAt)
            ON CONFLICT (user_id, metric) DO NOTHING
            """, nativeQuery = true)
    void ensureRow(@Param("userId") UUID userId,
                   @Param("metric") String metric,
                   @Param("limit") int limit,
                   @Param("resetsAt") OffsetDateTime resetsAt);

    @Modifying
    @Query("""
            UPDATE UsageQuota q SET q.used = 0, q.resetsAt = :newResetsAt
            WHERE q.user.id = :userId
              AND q.metric = :metric
              AND q.resetsAt <= :now
            """)
    int lazyResetIfDue(@Param("userId") UUID userId,
                       @Param("metric") String metric,
                       @Param("now") OffsetDateTime now,
                       @Param("newResetsAt") OffsetDateTime newResetsAt);

    @Modifying
    @Query("""
            UPDATE UsageQuota q SET q.quotaLimit = :limit
            WHERE q.user.id = :userId AND q.metric = :metric
            """)
    int updateLimit(@Param("userId") UUID userId,
                    @Param("metric") String metric,
                    @Param("limit") int limit);
}
