package com.outreach.score.dto;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data @Builder
public class CareerScoreResponse {
    private int    overallScore;
    private String band;
    private String bandRange;
    private int    resumeScore;
    private int    applicationsScore;
    private int    skillsScore;
    private int    profileScore;
    private int    githubScore;
    private int    cgpaComponent;
    private boolean githubWeightRedistributed;
    private String nextAction;
    private boolean isStale;
    private OffsetDateTime lastComputedAt;
    /** Framing note — always shown to users. */
    private String readinessNote;
}
