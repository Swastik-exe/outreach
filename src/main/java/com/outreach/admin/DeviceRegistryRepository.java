package com.outreach.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceRegistryRepository extends JpaRepository<DeviceRegistry, UUID> {
    Optional<DeviceRegistry> findByFingerprint(String fingerprint);
    List<DeviceRegistry> findByIsFlaggedTrue();
}
