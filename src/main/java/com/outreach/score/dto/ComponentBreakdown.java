package com.outreach.score.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class ComponentBreakdown {
    private int    value;
    private int    max;
    private int    upside;
    private String reason;
    private String nextAction;
}
