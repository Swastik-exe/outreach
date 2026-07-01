package com.outreach.profile;

import com.outreach.common.exception.BadRequestException;
import com.outreach.common.exception.ForbiddenException;
import com.outreach.common.exception.NotFoundException;
import com.outreach.profile.dto.*;
import com.outreach.score.CohortKeyValidator;
import com.outreach.score.ScoreService;
import com.outreach.user.User;
import com.outreach.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ProfileService {

    private final UserProfileRepository profileRepository;
    private final UserSkillRepository skillRepository;
    private final UserRepository userRepository;
    private final GitHubSyncService gitHubSyncService;
    @Lazy private final ScoreService scoreService; // lazy to avoid circular dep at startup

    // ── GET PROFILE ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        UserProfile profile = profileRepository.findByUserId(userId).orElse(null);
        List<UserSkill> skills = skillRepository.findByUserId(userId);

        return buildResponse(user, profile, skills);
    }

    // ── UPDATE PROFILE ────────────────────────────────────────────────────────

    public ProfileResponse updateProfile(UUID userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (!TargetRoleTaxonomy.isValidRole(req.getTargetRole())) {
            throw new BadRequestException("Invalid target_role. Use one of: " + TargetRoleTaxonomy.ROLES);
        }
        if (!TargetRoleTaxonomy.isValidDomain(req.getTargetDomain())) {
            throw new BadRequestException("Invalid target_domain. Use one of: " + TargetRoleTaxonomy.DOMAINS);
        }

        UserProfile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> UserProfile.builder()
                        .user(user)
                        .createdAt(OffsetDateTime.now())
                        .build());

        if (req.getFullName() != null) profile.setFullName(req.getFullName());
        if (req.getTargetRole() != null) profile.setTargetRole(req.getTargetRole());
        if (req.getTargetDomain() != null) profile.setTargetDomain(req.getTargetDomain());
        if (req.getGraduationYear() != null) profile.setGraduationYear(req.getGraduationYear());
        if (req.getCollegeName() != null) profile.setCollegeName(req.getCollegeName());
        if (req.getBranch() != null) profile.setBranch(req.getBranch());
        if (req.getCgpa() != null) profile.setCgpa(req.getCgpa());
        if (req.getGithubUsername() != null) profile.setGithubUsername(req.getGithubUsername());
        if (req.getLinkedinUrl() != null) profile.setLinkedinUrl(req.getLinkedinUrl());
        if (req.getLocation() != null) profile.setLocation(req.getLocation());

        // Derive cohort_key from controlled taxonomy only (D3)
        profile.setCohortKey(CohortKeyValidator.buildKey(
                profile.getTargetRole(), profile.getGraduationYear()));

        profile.setProfileCompletenessPct(computeCompleteness(profile));
        profile.setUpdatedAt(OffsetDateTime.now());
        profile = profileRepository.save(profile);
        scoreService.markStale(userId);

        List<UserSkill> skills = skillRepository.findByUserId(userId);
        return buildResponse(user, profile, skills);
    }

    // ── GITHUB SYNC ───────────────────────────────────────────────────────────

    public ProfileResponse syncGitHub(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        UserProfile profile = profileRepository.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("Profile not found. Create a profile first."));

        if (profile.getGithubUsername() == null || profile.getGithubUsername().isBlank()) {
            throw new BadRequestException("Set a GitHub username in your profile before syncing.");
        }

        String data = gitHubSyncService.fetchUserData(profile.getGithubUsername());
        profile.setGithubData(data);
        profile.setGithubConnected(true);
        profile.setGithubLastFetched(OffsetDateTime.now());
        profile.setUpdatedAt(OffsetDateTime.now());
        profileRepository.save(profile);
        scoreService.markStale(userId);

        List<UserSkill> skills = skillRepository.findByUserId(userId);
        return buildResponse(user, profile, skills);
    }

    // ── SKILLS ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SkillResponse> listSkills(UUID userId) {
        return skillRepository.findByUserId(userId).stream()
                .map(this::toSkillResponse)
                .collect(Collectors.toList());
    }

    public SkillResponse addSkill(UUID userId, SkillRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        UserSkill skill = UserSkill.builder()
                .user(user)
                .skillName(req.getSkillName())
                .proficiency(req.getProficiency())
                .source(req.getSource() != null ? req.getSource() : "self_reported")
                .build();
        skill = skillRepository.save(skill);
        scoreService.markStale(userId);
        return toSkillResponse(skill);
    }

    public SkillResponse updateSkill(UUID userId, UUID skillId, SkillRequest req) {
        UserSkill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));
        assertOwnership(userId, skill.getUser().getId());

        skill.setSkillName(req.getSkillName());
        skill.setProficiency(req.getProficiency());
        if (req.getSource() != null) skill.setSource(req.getSource());
        SkillResponse response = toSkillResponse(skillRepository.save(skill));
        scoreService.markStale(userId);
        return response;
    }

    public void deleteSkill(UUID userId, UUID skillId) {
        UserSkill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new NotFoundException("Skill not found"));
        assertOwnership(userId, skill.getUser().getId());
        skillRepository.delete(skill);
        scoreService.markStale(userId);
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

    private void assertOwnership(UUID requestingUserId, UUID resourceOwnerId) {
        if (!requestingUserId.equals(resourceOwnerId)) {
            throw new ForbiddenException("Access denied: this resource belongs to another user");
        }
    }

    private ProfileResponse buildResponse(User user, UserProfile profile, List<UserSkill> skills) {
        ProfileResponse.ProfileResponseBuilder b = ProfileResponse.builder()
                .userId(user.getId())
                .email(user.getEmail());
        if (profile != null) {
            b.profileId(profile.getId())
             .fullName(profile.getFullName())
             .targetRole(profile.getTargetRole())
             .targetDomain(profile.getTargetDomain())
             .cohortKey(profile.getCohortKey())
             .graduationYear(profile.getGraduationYear())
             .collegeName(profile.getCollegeName())
             .branch(profile.getBranch())
             .cgpa(profile.getCgpa())
             .githubUsername(profile.getGithubUsername())
             .linkedinUrl(profile.getLinkedinUrl())
             .location(profile.getLocation())
             .githubConnected(profile.getGithubConnected())
             .profileCompletenessPct(profile.getProfileCompletenessPct())
             .githubLastFetched(profile.getGithubLastFetched());
        }
        b.skills(skills.stream().map(this::toSkillResponse).collect(Collectors.toList()));
        return b.build();
    }

    private SkillResponse toSkillResponse(UserSkill s) {
        return SkillResponse.builder()
                .id(s.getId())
                .skillName(s.getSkillName())
                .proficiency(s.getProficiency())
                .source(s.getSource())
                .build();
    }

    /** Simple heuristic: +1 point per filled optional field out of 9. */
    private int computeCompleteness(UserProfile p) {
        int filled = 0;
        if (p.getFullName() != null) filled++;
        if (p.getTargetRole() != null) filled++;
        if (p.getTargetDomain() != null) filled++;
        if (p.getGraduationYear() != null) filled++;
        if (p.getCollegeName() != null) filled++;
        if (p.getBranch() != null) filled++;
        if (p.getCgpa() != null) filled++;
        if (p.getGithubUsername() != null) filled++;
        if (p.getLinkedinUrl() != null) filled++;
        return (int) Math.round(filled * 100.0 / 9);
    }
}
