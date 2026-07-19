package com.outreach.auth;

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
public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {
    Optional<UserSession> findByRefreshTokenHash(String refreshTokenHash);
    List<UserSession> findByUserIdAndIsActiveTrue(UUID userId);

    /** Hard-delete only sessions past expires_at (keeps inactive rows until then for reuse detection). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            DELETE FROM user_sessions
             WHERE expires_at < :cutoff
            """, nativeQuery = true)
    int deleteExpiredBefore(@Param("cutoff") OffsetDateTime cutoff);
}
