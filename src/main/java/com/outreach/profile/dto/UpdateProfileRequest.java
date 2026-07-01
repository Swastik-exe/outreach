package com.outreach.profile.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateProfileRequest {

    @Size(max = 255)
    private String fullName;

    /** Must be a value from TargetRoleTaxonomy.ROLES */
    @Size(max = 120)
    private String targetRole;

    /** Must be a value from TargetRoleTaxonomy.DOMAINS */
    @Size(max = 120)
    private String targetDomain;

    private Integer graduationYear;

    @Size(max = 255)
    private String collegeName;

    @Size(max = 120)
    private String branch;

    @DecimalMin("0.00") @DecimalMax("10.00")
    private BigDecimal cgpa;

    @Size(max = 120)
    private String githubUsername;

    @Size(max = 400)
    private String linkedinUrl;

    @Size(max = 160)
    private String location;
}
