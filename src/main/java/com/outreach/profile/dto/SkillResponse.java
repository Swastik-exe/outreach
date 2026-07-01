package com.outreach.profile.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data @Builder
public class SkillResponse {
    private UUID id;
    private String skillName;
    private short proficiency;
    private String source;
}
