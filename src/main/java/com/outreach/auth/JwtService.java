package com.outreach.auth;

import com.outreach.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.access-token-expiry-ms}")
    private long accessTokenExpiryMs;

    private SecretKey signingKey;

    @PostConstruct
    public void init() throws NoSuchAlgorithmException {
        // SHA-256 the raw secret so any length works as HMAC-SHA256 key (needs 256 bits)
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        byte[] keyBytes = MessageDigest.getInstance("SHA-256").digest(raw);
        signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(User user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + accessTokenExpiryMs);
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("plan", user.getPlanTier().name())
                .claim("role", user.getPlanTier() == com.outreach.billing.PlanTier.admin
                        ? "PLATFORM_ADMIN" : "USER")
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    /** @return the user UUID from a valid token, or null if invalid/expired. */
    public UUID extractUserId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return UUID.fromString(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT parse failure: {}", e.getMessage());
            return null;
        }
    }

    public long getAccessTokenExpiryMs() {
        return accessTokenExpiryMs;
    }
}
