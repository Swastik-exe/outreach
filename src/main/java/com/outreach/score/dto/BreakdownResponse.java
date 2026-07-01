package com.outreach.score.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class BreakdownResponse {
    private int    overallScore;
    private String band;
    private boolean githubWeightRedistributed;
    private String nextAction;
    private String readinessNote;

    private ComponentBreakdown resume;
    private ComponentBreakdown applications;
    private ComponentBreakdown skills;
    private ComponentBreakdown profile;
    private ComponentBreakdown github;
    private ComponentBreakdown cgpa;
}
