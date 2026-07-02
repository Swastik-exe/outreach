package com.outreach.common;

import com.outreach.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PdfValidationTest {

    @Test
    void acceptsValidPdfMagicBytes() {
        byte[] pdf = "%PDF-1.4\n%fake content".getBytes();
        assertDoesNotThrow(() -> PdfValidation.requirePdfMagicBytes(pdf));
    }

    @Test
    void rejectsNonPdfContent() {
        byte[] html = "<html>not a pdf</html>".getBytes();
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> PdfValidation.requirePdfMagicBytes(html));
        assertTrue(ex.getMessage().contains("PDF"));
    }

    @Test
    void rejectsEmptyFile() {
        assertThrows(BadRequestException.class,
                () -> PdfValidation.requirePdfMagicBytes(new byte[0]));
    }
}
