package com.outreach.resume.dto;

import java.util.UUID;

public record UploadResponse(
        UUID resumeId,
        String fileName,
        String analysisStatus,
        String message
) {}
