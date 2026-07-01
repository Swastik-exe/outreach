package com.outreach.billing;

import com.outreach.billing.SubStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {
    Optional<Subscription> findByUserId(UUID userId);
    Optional<Subscription> findByRazorpayOrderId(String razorpayOrderId);
    Optional<Subscription> findByRazorpaySubscriptionId(String razorpaySubscriptionId);

    @Query("""
            SELECT COALESCE(SUM(s.amountInr), 0)
            FROM Subscription s
            WHERE s.status = :status
              AND s.periodStart >= :start AND s.periodStart < :end
              AND s.amountInr IS NOT NULL
            """)
    Long sumActiveAmountInrStartedBetween(@Param("status") SubStatus status,
                                          @Param("start") OffsetDateTime start,
                                          @Param("end") OffsetDateTime end);

    default Long sumActiveAmountInrStartedThisMonth(OffsetDateTime start, OffsetDateTime end) {
        return sumActiveAmountInrStartedBetween(SubStatus.active, start, end);
    }
}
