package com.outreach.score;

import com.outreach.profile.UserProfile;
import com.outreach.profile.UserSkill;
import com.outreach.resume.Resume;
import com.outreach.tracker.AppSource;
import com.outreach.tracker.AppStatus;
import com.outreach.tracker.Application;
import com.outreach.tracker.ApplicationOutcome;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure JUnit 5 — no Spring context, runs fast.
 *
 * Key invariants verified:
 * 1. overall_score <= 1000 on EVERY code path
 * 2. Maxed profile WITH github = 1000
 * 3. Maxed profile WITHOUT github = 1000 (redistribution)
 * 4. Empty profile = 0
 * 5. "Gamed" profile (30 fake applied + all-5 self_reported skills)
 *    scores LOWER than a real progressed profile
 */
class ScoreComponentsTest {

    // ── RESUME ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("resume: no resume → 0 pts")
    void resume_noResume_zero() {
        assertEquals(0, ScoreComponents.computeResumeScore(null).value());
    }

    @Test
    @DisplayName("resume: inactive resume → 0 pts")
    void resume_inactiveResume_zero() {
        Resume r = Resume.builder().isActive(false).build();
        assertEquals(0, ScoreComponents.computeResumeScore(r).value());
    }

    @Test
    @DisplayName("resume: fully analysed (100/100/100) → 250 pts")
    void resume_perfect_250() {
        Resume r = Resume.builder()
                .isActive(true)
                .readinessScore(100).keywordScore(100).impactScore(100)
                .build();
        assertEquals(250, ScoreComponents.computeResumeScore(r).value());
    }

    @Test
    @DisplayName("resume: partial scores → correct weighted blend")
    void resume_partial_blend() {
        Resume r = Resume.builder()
                .isActive(true)
                .readinessScore(80).keywordScore(60).impactScore(50)
                .build();
        // (80*0.5 + 60*0.3 + 50*0.2)/100 * 250 = (40+18+10)/100*250 = 68/100*250 = 170
        int expected = (int) Math.round((80 * 0.5 + 60 * 0.3 + 50 * 0.2) / 100.0 * 250);
        assertEquals(expected, ScoreComponents.computeResumeScore(r).value());
    }

    @Test
    @DisplayName("resume: uploaded but not analysed → 50 pts partial credit")
    void resume_uploadedNotAnalysed_partialCredit() {
        Resume r = Resume.builder().isActive(true).build(); // no score fields
        assertEquals(50, ScoreComponents.computeResumeScore(r).value());
    }

    @Test
    @DisplayName("resume: value never exceeds MAX_RESUME")
    void resume_neverExceedsMax() {
        Resume r = Resume.builder()
                .isActive(true)
                .readinessScore(100).keywordScore(100).impactScore(100)
                .build();
        assertTrue(ScoreComponents.computeResumeScore(r).value() <= ScoreComponents.MAX_RESUME);
    }

    // ── APPLICATIONS ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("apps: empty → 0 pts")
    void apps_empty_zero() {
        assertEquals(0, ScoreComponents.computeApplicationsScore(List.of(), Map.of()).value());
    }

    @Test
    @DisplayName("apps: 30 fake 'applied' entries → hard-capped at 20 pts")
    void apps_30Applied_cappedAt20() {
        List<Application> apps = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            apps.add(Application.builder()
                    .currentStatus(AppStatus.applied)
                    .source(AppSource.manual)
                    .build());
        }
        int score = ScoreComponents.computeApplicationsScore(apps, Map.of()).value();
        assertEquals(ScoreComponents.MAX_APPLIED_POINTS, score,
                "30 fake 'applied' must be hard-capped at " + ScoreComponents.MAX_APPLIED_POINTS);
    }

    @Test
    @DisplayName("apps: 5 interview_done entries beat 30 fake applied")
    void apps_5Interviews_beatsGamer() {
        List<Application> gamedApps = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            gamedApps.add(Application.builder().currentStatus(AppStatus.applied).source(AppSource.manual).build());
        }
        int gamedScore = ScoreComponents.computeApplicationsScore(gamedApps, Map.of()).value();

        List<Application> realApps = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            realApps.add(Application.builder().currentStatus(AppStatus.interview_done).source(AppSource.manual).build());
        }
        int realScore = ScoreComponents.computeApplicationsScore(realApps, Map.of()).value();

        assertTrue(realScore > gamedScore,
                "5 interview_done (%d) must beat 30 fake applied (%d)".formatted(realScore, gamedScore));
    }

    @Test
    @DisplayName("apps: forwarded_email source gets 1.3x multiplier")
    void apps_forwardedEmail_higherThanManual() {
        List<Application> manual = List.of(
                Application.builder().currentStatus(AppStatus.interview_done).source(AppSource.manual).build());
        List<Application> forwarded = List.of(
                Application.builder().currentStatus(AppStatus.interview_done).source(AppSource.forwarded_email).build());

        int manualScore    = ScoreComponents.computeApplicationsScore(manual, Map.of()).value();
        int forwardedScore = ScoreComponents.computeApplicationsScore(forwarded, Map.of()).value();
        assertTrue(forwardedScore > manualScore,
                "forwarded_email (%d) must be > manual (%d)".formatted(forwardedScore, manualScore));
    }

    @Test
    @DisplayName("apps: offer_received scores higher than interview_done")
    void apps_offerReceivedHigher() {
        List<Application> interview = List.of(
                Application.builder().currentStatus(AppStatus.interview_done).source(AppSource.manual).build());
        List<Application> offer = List.of(
                Application.builder().currentStatus(AppStatus.offer_received).source(AppSource.manual).build());

        int interviewScore = ScoreComponents.computeApplicationsScore(interview, Map.of()).value();
        int offerScore     = ScoreComponents.computeApplicationsScore(offer, Map.of()).value();
        assertTrue(offerScore > interviewScore);
    }

    @Test
    @DisplayName("apps: value never exceeds MAX_APPLICATIONS")
    void apps_neverExceedsMax() {
        List<Application> apps = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            apps.add(Application.builder().currentStatus(AppStatus.offer_accepted).source(AppSource.forwarded_email).build());
        }
        assertTrue(ScoreComponents.computeApplicationsScore(apps, Map.of()).value() <= ScoreComponents.MAX_APPLICATIONS);
    }

    // ── SKILLS ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("skills: empty → 0 pts")
    void skills_empty_zero() {
        assertEquals(0, ScoreComponents.computeSkillsScore(List.of()).value());
    }

    @Test
    @DisplayName("skills: 10 self_reported prof=5 → capped below 150 (anti-gaming)")
    void skills_allSelfReportedProf5_cappedBelow150() {
        List<UserSkill> skills = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            skills.add(UserSkill.builder().proficiency((short) 5).source("self_reported").build());
        }
        int score = ScoreComponents.computeSkillsScore(skills).value();
        assertTrue(score < ScoreComponents.MAX_SKILLS,
                "All self_reported prof=5 must score below MAX_SKILLS=" + ScoreComponents.MAX_SKILLS
                        + " (actual: " + score + ")");
    }

    @Test
    @DisplayName("skills: 10 verified prof=5 → exactly 150 pts")
    void skills_allVerifiedProf5_full150() {
        List<UserSkill> skills = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            skills.add(UserSkill.builder().proficiency((short) 5).source("resume").build());
        }
        assertEquals(ScoreComponents.MAX_SKILLS, ScoreComponents.computeSkillsScore(skills).value());
    }

    @Test
    @DisplayName("skills: only first 10 slots counted")
    void skills_only10SlotsCount() {
        List<UserSkill> skills = new ArrayList<>();
        for (int i = 0; i < 15; i++) {
            skills.add(UserSkill.builder().proficiency((short) 5).source("resume").build());
        }
        // 10 verified prof=5 = 150; extra 5 must not push beyond 150
        assertEquals(ScoreComponents.MAX_SKILLS, ScoreComponents.computeSkillsScore(skills).value());
    }

    @Test
    @DisplayName("skills: value never exceeds MAX_SKILLS")
    void skills_neverExceedsMax() {
        List<UserSkill> skills = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            skills.add(UserSkill.builder().proficiency((short) 5).source("github").build());
        }
        assertTrue(ScoreComponents.computeSkillsScore(skills).value() <= ScoreComponents.MAX_SKILLS);
    }

    // ── PROFILE ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("profile: null profile → 0 pts")
    void profile_null_zero() {
        assertEquals(0, ScoreComponents.computeProfileScore(null).value());
    }

    @Test
    @DisplayName("profile: 100% complete → 150 pts")
    void profile_100pct_150() {
        UserProfile p = UserProfile.builder().profileCompletenessPct(100).build();
        assertEquals(150, ScoreComponents.computeProfileScore(p).value());
    }

    @Test
    @DisplayName("profile: 70% complete → 105 pts")
    void profile_70pct_105() {
        UserProfile p = UserProfile.builder().profileCompletenessPct(70).build();
        assertEquals(105, ScoreComponents.computeProfileScore(p).value());
    }

    // ── GITHUB ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("github: not connected → 0 pts")
    void github_notConnected_zero() {
        assertEquals(0, ScoreComponents.computeGithubScore(null).value());
    }

    @Test
    @DisplayName("github: connected but no data → 10 pts base")
    void github_connectedNoData_10() {
        UserProfile p = UserProfile.builder().githubConnected(true).build();
        assertEquals(10, ScoreComponents.computeGithubScore(p).value());
    }

    @Test
    @DisplayName("github: 30 repos + 50 followers → 150 pts max")
    void github_maxReposFollowers_150() {
        UserProfile p = UserProfile.builder()
                .githubConnected(true)
                .githubData("{\"public_repos\":30,\"followers\":50}")
                .build();
        assertEquals(150, ScoreComponents.computeGithubScore(p).value());
    }

    // ── CGPA ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("cgpa: null → 0 pts")
    void cgpa_null_zero() {
        assertEquals(0, ScoreComponents.computeCgpaScore(null).value());
    }

    @Test
    @DisplayName("cgpa: 10/10 → 100 pts")
    void cgpa_10of10_100() {
        UserProfile p = UserProfile.builder().cgpa(BigDecimal.TEN).build();
        assertEquals(100, ScoreComponents.computeCgpaScore(p).value());
    }

    @Test
    @DisplayName("cgpa: 4.0/4.0 → 100 pts (GPA scale)")
    void cgpa_4of4_100() {
        UserProfile p = UserProfile.builder().cgpa(new BigDecimal("4.0")).build();
        assertEquals(100, ScoreComponents.computeCgpaScore(p).value());
    }

    @Test
    @DisplayName("cgpa: 8.5/10 → 85 pts")
    void cgpa_8_5of10_85() {
        UserProfile p = UserProfile.builder().cgpa(new BigDecimal("8.5")).build();
        assertEquals(85, ScoreComponents.computeCgpaScore(p).value());
    }

    // ── OVERALL + REDISTRIBUTION ─────────────────────────────────────────────

    @Test
    @DisplayName("overall: maxed WITH github → exactly 1000")
    void overall_maxedWithGithub_1000() {
        int total = ScoreComponents.computeOverall(true,
                new ComponentResult(250, 250, "", ""),
                new ComponentResult(200, 200, "", ""),
                new ComponentResult(150, 150, "", ""),
                new ComponentResult(150, 150, "", ""),
                new ComponentResult(150, 150, "", ""),
                new ComponentResult(100, 100, "", ""));
        assertEquals(1000, total, "Maxed profile WITH github must equal exactly 1000");
    }

    @Test
    @DisplayName("overall: maxed WITHOUT github (redistribution) → exactly 1000")
    void overall_maxedWithoutGithub_1000() {
        // github = 0, others maxed; sum = 850 → scaled to 1000
        int total = ScoreComponents.computeOverall(false,
                new ComponentResult(250, 250, "", ""),
                new ComponentResult(200, 200, "", ""),
                new ComponentResult(150, 150, "", ""),
                new ComponentResult(150, 150, "", ""),
                new ComponentResult(0,   150, "", ""),  // not connected
                new ComponentResult(100, 100, "", ""));
        assertEquals(1000, total, "Maxed non-GitHub profile must also reach exactly 1000");
    }

    @Test
    @DisplayName("overall: empty profile (no github) → 0")
    void overall_emptyNoGithub_zero() {
        int total = ScoreComponents.computeOverall(false,
                new ComponentResult(0, 250, "", ""),
                new ComponentResult(0, 200, "", ""),
                new ComponentResult(0, 150, "", ""),
                new ComponentResult(0, 150, "", ""),
                new ComponentResult(0, 150, "", ""),
                new ComponentResult(0, 100, "", ""));
        assertEquals(0, total);
    }

    @Test
    @DisplayName("overall: never exceeds 1000 even with over-max inputs")
    void overall_neverExceeds1000() {
        int total = ScoreComponents.computeOverall(true,
                new ComponentResult(300, 250, "", ""),  // intentionally over-max
                new ComponentResult(250, 200, "", ""),
                new ComponentResult(200, 150, "", ""),
                new ComponentResult(200, 150, "", ""),
                new ComponentResult(200, 150, "", ""),
                new ComponentResult(150, 100, "", ""));
        assertTrue(total <= 1000, "Score must never exceed 1000 (got " + total + ")");
    }

    // ── ANTI-GAMING: gamed profile vs real profile ────────────────────────────

    @Test
    @DisplayName("anti-gaming: gamed profile scores LOWER than real progressed profile")
    void antiGaming_gamedLowerThanReal() {
        // ── Gamed profile ──
        // 30 fake applied (hard-capped at 20), 10 self_reported prof=5, CGPA=10, no resume/profile/github
        List<Application> gamedApps = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            gamedApps.add(Application.builder().currentStatus(AppStatus.applied).source(AppSource.manual).build());
        }
        List<UserSkill> gamedSkills = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            gamedSkills.add(UserSkill.builder().proficiency((short) 5).source("self_reported").build());
        }
        UserProfile gamedProfile = UserProfile.builder().cgpa(BigDecimal.TEN).profileCompletenessPct(0).build();

        ComponentResult gamedResume   = ScoreComponents.computeResumeScore(null);
        ComponentResult gamedAppsR    = ScoreComponents.computeApplicationsScore(gamedApps, Map.of());
        ComponentResult gamedSkillsR  = ScoreComponents.computeSkillsScore(gamedSkills);
        ComponentResult gamedProfileR = ScoreComponents.computeProfileScore(null);
        ComponentResult gamedGithub   = ScoreComponents.computeGithubScore(null);
        ComponentResult gamedCgpa     = ScoreComponents.computeCgpaScore(gamedProfile);
        int gamedTotal = ScoreComponents.computeOverall(false,
                gamedResume, gamedAppsR, gamedSkillsR, gamedProfileR, gamedGithub, gamedCgpa);

        // ── Real progressed profile ──
        // Resume analysed (80/70/75), 5 interview_done, 8 verified skills prof=4, profile 70%, github 15 repos+30 followers, CGPA 8.5
        Resume realResume = Resume.builder().isActive(true)
                .readinessScore(80).keywordScore(70).impactScore(75).build();
        List<Application> realApps = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            realApps.add(Application.builder().currentStatus(AppStatus.interview_done).source(AppSource.manual).build());
        }
        List<UserSkill> realSkills = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            realSkills.add(UserSkill.builder().proficiency((short) 4).source("resume").build());
        }
        UserProfile realProfile = UserProfile.builder()
                .profileCompletenessPct(70)
                .githubConnected(true)
                .githubData("{\"public_repos\":15,\"followers\":30}")
                .cgpa(new BigDecimal("8.5"))
                .build();

        ComponentResult realResumeR   = ScoreComponents.computeResumeScore(realResume);
        ComponentResult realAppsR     = ScoreComponents.computeApplicationsScore(realApps, Map.of());
        ComponentResult realSkillsR   = ScoreComponents.computeSkillsScore(realSkills);
        ComponentResult realProfileR  = ScoreComponents.computeProfileScore(realProfile);
        ComponentResult realGithub    = ScoreComponents.computeGithubScore(realProfile);
        ComponentResult realCgpa      = ScoreComponents.computeCgpaScore(realProfile);
        int realTotal = ScoreComponents.computeOverall(true,
                realResumeR, realAppsR, realSkillsR, realProfileR, realGithub, realCgpa);

        assertTrue(gamedTotal < realTotal,
                "Gamed profile (%d) must score LOWER than real progressed profile (%d)"
                        .formatted(gamedTotal, realTotal));
        // Extra check: gamed must be below "Strong" band (≤500)
        assertTrue(gamedTotal <= 500,
                "Gamed profile (%d) must not reach 'Strong' band".formatted(gamedTotal));
    }

    // ── BAND ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("band: 0 → Getting Started")
    void band_0_gettingStarted() {
        assertEquals("Getting Started", ScoreComponents.toBand(0));
    }

    @Test
    @DisplayName("band: 300 → Getting Started")
    void band_300_gettingStarted() {
        assertEquals("Getting Started", ScoreComponents.toBand(300));
    }

    @Test
    @DisplayName("band: 301 → Building")
    void band_301_building() {
        assertEquals("Building", ScoreComponents.toBand(301));
    }

    @Test
    @DisplayName("band: 751 → Placement Ready")
    void band_751_placementReady() {
        assertEquals("Placement Ready", ScoreComponents.toBand(751));
    }

    @Test
    @DisplayName("band: 1000 → Placement Ready")
    void band_1000_placementReady() {
        assertEquals("Placement Ready", ScoreComponents.toBand(1000));
    }
}
