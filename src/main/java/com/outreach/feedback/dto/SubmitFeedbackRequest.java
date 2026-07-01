package com.outreach.feedback.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SubmitFeedbackRequest {

    @NotBlank
    @Size(max = 5000)
    private String message;

    @Size(max = 120)
    private String screen;

    @Pattern(regexp = "bug|feature", message = "type must be bug or feature")
    private String type = "bug";
}
