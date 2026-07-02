package com.outreach.resume.storage;

import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;

/**
 * Cloudflare R2 storage via the AWS S3 SDK (R2 is S3-compatible).
 */
@Slf4j
public class R2Storage implements FileStorage {

    private static final Duration API_CALL_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration API_ATTEMPT_TIMEOUT = Duration.ofSeconds(15);

    private final S3Client s3;
    private final String bucket;

    public R2Storage(String accountId, String accessKey, String secretKey, String bucket) {
        this.bucket = bucket;
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create("https://" + accountId + ".r2.cloudflarestorage.com"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .region(Region.of("auto"))
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallTimeout(API_CALL_TIMEOUT)
                        .apiCallAttemptTimeout(API_ATTEMPT_TIMEOUT)
                        .build())
                .build();
        log.info("R2Storage ready — bucket={}", bucket);
    }

    @Override
    public String store(String key, byte[] data, String contentType) throws IOException {
        try {
            s3.putObject(
                    PutObjectRequest.builder().bucket(bucket).key(key)
                            .contentType(contentType).contentLength((long) data.length).build(),
                    RequestBody.fromBytes(data)
            );
            return "r2://" + key;
        } catch (Exception e) {
            throw new IOException("R2 upload failed for key=" + key, e);
        }
    }

    @Override
    public InputStream retrieve(String key) throws IOException {
        try {
            return s3.getObject(
                    GetObjectRequest.builder().bucket(bucket).key(key).build(),
                    ResponseTransformer.toInputStream()
            );
        } catch (Exception e) {
            throw new IOException("R2 download failed for key=" + key, e);
        }
    }

    @Override
    public void delete(String key) throws IOException {
        try {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (Exception e) {
            throw new IOException("R2 delete failed for key=" + key, e);
        }
    }
}
