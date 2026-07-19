package com.outreach.tracker.inbound;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
public interface InboundEmailDraftRepository extends JpaRepository<InboundEmailDraft, UUID> {

    List<InboundEmailDraft> findByUserIdAndStatus(UUID userId, String status);

    Page<InboundEmailDraft> findByUserIdAndStatusOrderByCreatedAtDesc(
            UUID userId, String status, Pageable pageable);
    List<InboundEmailDraft> findByUserId(UUID userId);
    Optional<InboundEmailDraft> findByIdAndUserId(UUID id, UUID userId);

    /**
     * DPDP TTL purge: null out raw_payload for drafts that were
     * confirmed or discarded more than 14 days ago.
     */
    @Modifying
    @Query(value = """
            UPDATE inbound_email_drafts
               SET raw_payload = NULL
             WHERE status IN ('confirmed','discarded')
               AND created_at < :cutoff
               AND raw_payload IS NOT NULL
            """, nativeQuery = true)
    int purgeRawPayload(@Param("cutoff") OffsetDateTime cutoff);

    /** Hard-delete resolved drafts only after payload has been cleared. Never touches pending drafts. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            DELETE FROM inbound_email_drafts
             WHERE status IN ('confirmed','discarded')
               AND created_at < :cutoff
               AND raw_payload IS NULL
            """, nativeQuery = true)
    int deleteResolvedBefore(@Param("cutoff") OffsetDateTime cutoff);
}
