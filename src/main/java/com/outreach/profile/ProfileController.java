package com.outreach.profile;

import com.outreach.common.ApiResponse;
import com.outreach.common.CurrentUser;
import com.outreach.profile.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping
    public ResponseEntity<ApiResponse<ProfileResponse>> getProfile() {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(profileService.getProfile(userId)));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<ProfileResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest req) {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(profileService.updateProfile(userId, req)));
    }

    @PostMapping("/github/sync")
    public ResponseEntity<ApiResponse<ProfileResponse>> syncGitHub() {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(profileService.syncGitHub(userId)));
    }

    @GetMapping("/skills")
    public ResponseEntity<ApiResponse<List<SkillResponse>>> listSkills() {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(profileService.listSkills(userId)));
    }

    @PostMapping("/skills")
    public ResponseEntity<ApiResponse<SkillResponse>> addSkill(@Valid @RequestBody SkillRequest req) {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(profileService.addSkill(userId, req)));
    }

    @PutMapping("/skills/{id}")
    public ResponseEntity<ApiResponse<SkillResponse>> updateSkill(
            @PathVariable UUID id,
            @Valid @RequestBody SkillRequest req) {
        UUID userId = CurrentUser.getUserId();
        return ResponseEntity.ok(ApiResponse.ok(profileService.updateSkill(userId, id, req)));
    }

    @DeleteMapping("/skills/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSkill(@PathVariable UUID id) {
        UUID userId = CurrentUser.getUserId();
        profileService.deleteSkill(userId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
