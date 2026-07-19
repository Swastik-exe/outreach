package com.outreach.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            DELETE FROM password_reset_tokens
             WHERE expires_at < :expiredCutoff
                OR (used_at IS NOT NULL AND used_at < :usedCutoff)
            """, nativeQuery = true)
    int deleteExpiredOrUsedBefore(
            @Param("expiredCutoff") OffsetDateTime expiredCutoff,
            @Param("usedCutoff") OffsetDateTime usedCutoff);
}
