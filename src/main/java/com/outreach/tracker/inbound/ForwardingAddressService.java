package com.outreach.tracker.inbound;

import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Issues a unique forwarding email address per user.
 *
 * Format: u_{token}@{domain}
 * Token: 20-char base32 (A-Z + 2-7), SecureRandom. Retried on the rare
 * unique collision (E5). Not guessable — it is semi-public (printed in the UI).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ForwardingAddressService {

    private static final String BASE32     = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int    TOKEN_LEN  = 20;
    private static final int    MAX_RETRY  = 5;
    private static final SecureRandom RNG  = new SecureRandom();

    @Value("${app.inbound.email-domain:track.outreachos.com}")
    private String emailDomain;

    private final ForwardingAddressRepository repo;
    private final UserRepository userRepo;

    /**
     * Returns the existing forwarding address for the user, or creates one
     * with a fresh long-random token (retried on unique-collision).
     */
    @Transactional
    public ForwardingAddress getOrCreate(UUID userId) {
        return repo.findByUserId(userId).orElseGet(() -> create(userId));
    }

    private ForwardingAddress create(UUID userId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        for (int attempt = 1; attempt <= MAX_RETRY; attempt++) {
            String token   = generateToken();
            String address = "u_" + token + "@" + emailDomain;

            try {
                ForwardingAddress fa = ForwardingAddress.builder()
                        .user(user)
                        .address(address)
                        .createdAt(OffsetDateTime.now())
                        .build();
                return repo.save(fa);
            } catch (DataIntegrityViolationException ex) {
                log.warn("Forwarding address collision on attempt {} (token={}), retrying", attempt, token);
            }
        }
        throw new IllegalStateException("Could not generate a unique forwarding address after " + MAX_RETRY + " attempts");
    }

    private static String generateToken() {
        StringBuilder sb = new StringBuilder(TOKEN_LEN);
        for (int i = 0; i < TOKEN_LEN; i++) {
            sb.append(BASE32.charAt(RNG.nextInt(BASE32.length())));
        }
        return sb.toString();
    }
}
