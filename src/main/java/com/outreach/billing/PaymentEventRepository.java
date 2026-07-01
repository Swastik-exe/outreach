package com.outreach.billing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentEventRepository extends JpaRepository<PaymentEvent, UUID> {
    List<PaymentEvent> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<PaymentEvent> findByProviderEventId(String providerEventId);

    @Query("""
            SELECT COALESCE(SUM(p.amountInr), 0)
            FROM PaymentEvent p
            WHERE p.createdAt >= :start AND p.createdAt < :end
              AND p.amountInr IS NOT NULL
            """)
    Long sumAmountInrBetween(@Param("start") OffsetDateTime start,
                             @Param("end") OffsetDateTime end);
}
