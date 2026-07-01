package com.outreach.feedback;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FeedbackRepository extends JpaRepository<Feedback, UUID> {
    List<Feedback> findByType(String type);
    List<Feedback> findByUserId(UUID userId);

    @EntityGraph(attributePaths = "user")
    Page<Feedback> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
