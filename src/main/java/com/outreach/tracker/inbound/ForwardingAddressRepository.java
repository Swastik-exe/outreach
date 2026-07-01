package com.outreach.tracker.inbound;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ForwardingAddressRepository extends JpaRepository<ForwardingAddress, UUID> {
    Optional<ForwardingAddress> findByUserId(UUID userId);
    Optional<ForwardingAddress> findByAddress(String address);
}
