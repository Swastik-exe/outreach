package com.outreach.user;

import com.outreach.auth.AuthService;
import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authenticated self-service account actions. Lives outside the public
 * {@code /api/v1/auth/**} space so deletion always requires a valid JWT.
 */
@RestController
@RequestMapping("/api/v1/account")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;
    private final AuthService authService;

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> deleteAccount(HttpServletResponse response) {
        accountService.deleteAccount(CurrentUser.getUserId());
        authService.logout(null, response);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
