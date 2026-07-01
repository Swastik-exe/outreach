package com.outreach.profile.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data @Builder
public class ProfileResponse {
    private UUID profileId;
    private UUID userId;
    private String email;
    private String fullName;
    private String targetRole;
    private String targetDomain;
    private String cohortKey;
    private Integer graduationYear;
    private String collegeName;
    private String branch;
    private BigDecimal cgpa;
    private String githubUsername;
    private String linkedinUrl;
    private String location;
    private Boolean githubConnected;
    private Integer profileCompletenessPct;
    private OffsetDateTime githubLastFetched;
    private List<SkillResponse> skills;
}
