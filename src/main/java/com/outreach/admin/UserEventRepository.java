package com.outreach.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
public interface UserEventRepository extends JpaRepository<UserEvent, UUID> {

    @Query(value = """
            SELECT COUNT(DISTINCT uid) FROM (
              SELECT u.id AS uid FROM users u
              WHERE u.last_active_at >= :start AND u.last_active_at < :end
              UNION
              SELECT e.user_id AS uid FROM user_events e
              WHERE e.created_at >= :start AND e.created_at < :end
                AND e.user_id IS NOT NULL
            ) active_users
            """, nativeQuery = true)
    long countActiveUsersBetween(@Param("start") OffsetDateTime start,
                                 @Param("end") OffsetDateTime end);
}
