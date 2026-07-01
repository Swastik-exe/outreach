package com.outreach.resume.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Picks R2Storage when all four R2 env vars are present; falls back to LocalFileStorage.
 * No R2 account needed for local development.
 */
@Slf4j
@Configuration
public class FileStorageConfig {

    @Bean
    public FileStorage fileStorage(
            @Value("${app.storage.r2.account-id:}") String accountId,
            @Value("${app.storage.r2.access-key:}") String accessKey,
            @Value("${app.storage.r2.secret-key:}") String secretKey,
            @Value("${app.storage.r2.bucket:}") String bucket,
            @Value("${app.storage.local.path:./storage}") String localPath
    ) {
        if (!accountId.isBlank() && !accessKey.isBlank()
                && !secretKey.isBlank() && !bucket.isBlank()) {
            log.info("FileStorage: using Cloudflare R2 (bucket={})", bucket);
            return new R2Storage(accountId, accessKey, secretKey, bucket);
        }
        log.info("FileStorage: using LocalFileStorage (path={})", localPath);
        return new LocalFileStorage(localPath);
    }
}
