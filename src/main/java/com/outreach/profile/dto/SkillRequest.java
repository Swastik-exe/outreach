package com.outreach.profile.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SkillRequest {

    @NotBlank @Size(max = 100)
    private String skillName;

    @Min(1) @Max(5)
    private short proficiency;

    /** self_reported | resume | github */
    @Size(max = 40)
    private String source;
}
