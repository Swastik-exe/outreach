package com.outreach.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank @Email
    private String email;

    /** Minimum 8 chars; actual strength enforced by pattern in AuthService. */
    @NotBlank @Size(min = 8, max = 128)
    private String password;
}
