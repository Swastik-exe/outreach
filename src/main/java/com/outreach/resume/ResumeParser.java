package com.outreach.resume;

import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.concurrent.*;

/**
 * Extracts plain text from a PDF using Apache Tika.
 * Runs in a dedicated single-thread executor with a hard 30-second timeout.
 * Image-only / garbage-text PDFs are rejected via length, word-count, alpha ratio,
 * and text-to-page density heuristics.
 */
@Slf4j
@Component
public class ResumeParser {

    private static final int    TIMEOUT_SECONDS   = 30;
    private static final int    MIN_TEXT_LENGTH   = 100;
    private static final int    MIN_WORD_COUNT    = 20;
    private static final double MIN_ALPHA_RATIO   = 0.45;
    private static final int    MIN_CHARS_PER_PAGE = 120;
    private static final int    MAX_STRING_LEN    = 500_000;

    public record ParseResult(String text, boolean imagePdf, String errorMessage) {
        public static ParseResult success(String text) {
            return new ParseResult(text, false, null);
        }
        public static ParseResult scannedPdf(String reason) {
            return new ParseResult("", true,
                    reason != null ? reason : "This appears to be a scanned or image-only PDF. "
                    + "Please upload a text-based PDF so we can read its content.");
        }
        public static ParseResult failure(String msg) {
            return new ParseResult("", false, msg);
        }
        public boolean isSuccess() { return errorMessage == null && !imagePdf; }
    }

    private record ParsedContent(String text, Metadata metadata) {}

    public ParseResult parse(InputStream pdfStream) {
        ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "tika-parser");
            t.setDaemon(true);
            return t;
        });

        Future<ParsedContent> future = executor.submit(() -> {
            Tika tika = new Tika();
            tika.setMaxStringLength(MAX_STRING_LEN);
            Metadata metadata = new Metadata();
            String text = tika.parseToString(pdfStream, metadata);
            return new ParsedContent(text, metadata);
        });

        try {
            ParsedContent parsed = future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            String text = parsed.text();
            if (text == null || text.strip().length() < MIN_TEXT_LENGTH) {
                log.warn("Tika extracted only {} chars — likely image-only PDF",
                        text == null ? 0 : text.strip().length());
                return ParseResult.scannedPdf(null);
            }
            String stripped = text.strip();
            if (looksLikeScannedOrGarbage(stripped, parsed.metadata())) {
                log.warn("PDF failed text-quality heuristics (len={}, words={})",
                        stripped.length(), countWords(stripped));
                return ParseResult.scannedPdf(
                        "This PDF does not contain enough readable text for analysis. "
                        + "Please upload a text-based PDF (not a scanned image or placeholder file).");
            }
            return ParseResult.success(stripped);
        } catch (TimeoutException e) {
            future.cancel(true);
            log.warn("Tika parse timed out after {}s", TIMEOUT_SECONDS);
            return ParseResult.failure("PDF parsing timed out. Please try again with a smaller file.");
        } catch (ExecutionException e) {
            log.warn("Tika parse failed: {}", e.getCause().getMessage());
            return ParseResult.failure("Could not read PDF content: " + e.getCause().getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ParseResult.failure("Parsing interrupted");
        } finally {
            executor.shutdownNow();
        }
    }

    static boolean looksLikeScannedOrGarbage(String text, Metadata metadata) {
        int len = text.length();
        int words = countWords(text);
        if (words < MIN_WORD_COUNT) {
            return true;
        }
        long alpha = text.chars().filter(Character::isLetterOrDigit).count();
        if ((double) alpha / len < MIN_ALPHA_RATIO) {
            return true;
        }
        int pages = pageCount(metadata);
        if (pages > 0 && (double) len / pages < MIN_CHARS_PER_PAGE) {
            return true;
        }
        // Single-page image PDFs with OCR garbage: high unique-char ratio, few real words
        if (pages <= 1 && words < 40 && uniqueCharRatio(text) > 0.35) {
            return true;
        }
        return false;
    }

    private static int countWords(String text) {
        if (text.isBlank()) return 0;
        return text.trim().split("\\s+").length;
    }

    private static double uniqueCharRatio(String text) {
        if (text.isEmpty()) return 0;
        return (double) text.chars().distinct().count() / text.length();
    }

    private static int pageCount(Metadata metadata) {
        for (String key : new String[]{
                "xmpTPg:NPages",
                "meta:page-count",
                "pdf:docinfo:page_count"
        }) {
            String val = metadata.get(key);
            if (val != null && !val.isBlank()) {
                try {
                    int n = (int) Math.ceil(Double.parseDouble(val.trim()));
                    if (n > 0) return n;
                } catch (NumberFormatException ignored) {
                    // try next key
                }
            }
        }
        return 0;
    }
}
