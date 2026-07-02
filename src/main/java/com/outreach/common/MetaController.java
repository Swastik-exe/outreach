package com.outreach.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Public build metadata — used to confirm which revision is live on Render. */
@RestController
@RequestMapping("/api/v1/meta")
public class MetaController {

    @Value("${app.build-tag:local}")
    private String buildTag;

    @GetMapping("/build")
    public ApiResponse<Map<String, String>> build() {
        return ApiResponse.ok(Map.of("tag", buildTag));
    }
}
