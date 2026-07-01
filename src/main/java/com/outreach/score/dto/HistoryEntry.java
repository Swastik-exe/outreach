package com.outreach.score.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data @Builder
public class HistoryEntry {
    private LocalDate recordedDate;
    private int overallScore;
    private String band;
}
