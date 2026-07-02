package com.outreach.common;

import com.outreach.common.exception.BadRequestException;

import java.nio.charset.StandardCharsets;

/** Validates PDF uploads beyond MIME type (which clients can spoof). */
public final class PdfValidation {

    private static final byte[] PDF_MAGIC = "%PDF".getBytes(StandardCharsets.US_ASCII);

    private PdfValidation() {}

    public static void requirePdfMagicBytes(byte[] data) {
        if (data == null || data.length < PDF_MAGIC.length) {
            throw new BadRequestException("File is not a valid PDF.");
        }
        for (int i = 0; i < PDF_MAGIC.length; i++) {
            if (data[i] != PDF_MAGIC[i]) {
                throw new BadRequestException(
                        "File content is not a PDF. Export from Word/Google Docs as PDF and try again.");
            }
        }
    }
}
