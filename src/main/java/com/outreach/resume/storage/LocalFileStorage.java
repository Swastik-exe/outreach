package com.outreach.resume.storage;

import lombok.extern.slf4j.Slf4j;

import java.io.*;
import java.nio.file.*;

/**
 * Dev-only storage: writes files under ${app.storage.local.path} (default ./storage).
 * Not used in production; R2Storage takes over when R2 env vars are present.
 */
@Slf4j
public class LocalFileStorage implements FileStorage {

    private final Path root;

    public LocalFileStorage(String rootPath) {
        this.root = Paths.get(rootPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
            log.info("LocalFileStorage ready at {}", root);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create local storage dir: " + root, e);
        }
    }

    @Override
    public String store(String key, byte[] data, String contentType) throws IOException {
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) {
            throw new IOException("Path traversal detected: " + key);
        }
        Files.createDirectories(target.getParent());
        Files.write(target, data, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        log.debug("Stored {} bytes at {}", data.length, target);
        return "local://" + key;
    }

    @Override
    public InputStream retrieve(String key) throws IOException {
        Path source = root.resolve(key).normalize();
        if (!source.startsWith(root)) {
            throw new IOException("Path traversal detected: " + key);
        }
        return new BufferedInputStream(Files.newInputStream(source));
    }

    @Override
    public void delete(String key) throws IOException {
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) {
            throw new IOException("Path traversal detected: " + key);
        }
        Files.deleteIfExists(target);
    }
}
