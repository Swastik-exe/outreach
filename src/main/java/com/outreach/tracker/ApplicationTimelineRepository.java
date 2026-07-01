package com.outreach.tracker;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicationTimelineRepository extends JpaRepository<ApplicationTimeline, UUID> {

    List<ApplicationTimeline> findByApplicationIdOrderByOccurredAtAsc(UUID applicationId);

    Page<ApplicationTimeline> findByApplicationIdOrderByOccurredAtAsc(UUID applicationId, Pageable pageable);
}
