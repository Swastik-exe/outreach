package com.outreach.resume.storage;

import java.io.IOException;
import java.io.InputStream;

/**
 * Abstraction over file storage back-ends.
 * Production uses R2Storage (Cloudflare R2); dev uses LocalFileStorage.
 * Raw public URLs are never exposed — access is always through the application.
 */
public interface FileStorage {

    /**
     * Persist the given bytes.
     *
     * @param key         relative path / object key (e.g. "resumes/{userId}/{uuid}.pdf")
     * @param data        raw bytes to store
     * @param contentType MIME type
     * @return an opaque internal URL (local:// or r2://) stored in the DB; never a
     *         public URL.
     */
    String store(String key, byte[] data, String contentType) throws IOException;

    /**
     * Retrieve file bytes by the opaque key returned from {@link #store}.
     */
    InputStream retrieve(String key) throws IOException;

    /** Permanently remove the stored object. Must be safe when the key no longer exists. */
    void delete(String key) throws IOException;

    /** Extract the provider-independent object key from an internal local:// or r2:// location. */
    static String keyFromLocation(String location) {
        if (location == null || location.isBlank()) {
            return "";
        }
        int separator = location.indexOf("://");
        return separator >= 0 ? location.substring(separator + 3) : location;
    }
}
