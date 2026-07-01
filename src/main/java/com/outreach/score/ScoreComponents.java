package com.outreach.score;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.outreach.profile.UserProfile;
import com.outreach.profile.UserSkill;
import com.outreach.resume.Resume;
import com.outreach.tracker.AppSource;
import com.outreach.tracker.AppStatus;
import com.outreach.tracker.Application;
import com.outreach.tracker.ApplicationOutcome;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pure, stateless scoring functions — no Spring dependencies, fully unit-testable.
 *
 * Weights: resume=250, applications=200, skills=150, profile=150, github=150, cgpa=100 → 1000
 *
 * GITHUB REDISTRIBUTION (D9): when GitHub is not connected github_score=0, and the
 * non-GitHub raw sum (max=850) is scaled by 1000/850 so a maxed non-GitHub profile
 * still reaches exactly 1000 — no penalty for non-CS users.
 *
 * ANTI-GAMING:
 *  - applications: hard cap of {@value #MAX_APPLIED_POINTS} pts on unverified "applied" bucket;
 *    progression (OA→interview→offer) is worth far more per entry.
 *  - skills: self_reported proficiency is capped internally at 3 so claiming 5 everywhere
 *    cannot dominate; source="resume"/"github" earns full credit.
 */
public final class ScoreComponents {

    private ScoreComponents() {}

    // Singleton — ObjectMapper is thread-safe and expensive to construct per call
    private static final ObjectMapper MAPPER = new ObjectMapper();

    // ── Component maxima (must sum to 1000) ──────────────────────────────────
    static final int MAX_RESUME       = 250;
    static final int MAX_APPLICATIONS = 200;
    static final int MAX_SKILLS       = 150;
    static final int MAX_PROFILE      = 150;
    static final int MAX_GITHUB       = 150;
    static final int MAX_CGPA         = 100;

    // GitHub-missing sum (1000 - 150 = 850) used for redistribution scale
    static final double GITHUB_SCALE = 1000.0 / 850.0;

    /** Hard cap: total points from unverified "applied" entries (anti-gaming). */
    static final int MAX_APPLIED_POINTS = 20;

    /** Only the first N skills are counted (encourages depth over breadth). */
    static final int MAX_SKILL_SLOTS = 10;

    // ── RESUME (0..250) ──────────────────────────────────────────────────────

    public static ComponentResult computeResumeScore(Resume resume) {
        if (resume == null || !Boolean.TRUE.equals(resume.getIsActive())) {
            return new ComponentResult(0, MAX_RESUME,
                    "No active resume uploaded",
                    "Upload and activate a resume to gain up to +" + MAX_RESUME + " pts");
        }

        Integer readiness = resume.getReadinessScore();
        Integer keyword   = resume.getKeywordScore();
        Integer impact    = resume.getImpactScore();

        if (readiness != null && keyword != null && impact != null) {
            // Weighted blend: readiness=50%, keyword=30%, impact=20%
            double pct   = (readiness * 0.50 + keyword * 0.30 + impact * 0.20) / 100.0;
            int    value = clamp((int) Math.round(pct * MAX_RESUME), 0, MAX_RESUME);
            int    upside = MAX_RESUME - value;
            return new ComponentResult(value, MAX_RESUME,
                    String.format("Resume analysed: readiness=%d, keyword=%d, impact=%d",
                            readiness, keyword, impact),
                    upside > 20 ? "Improve keyword coverage to add ~" + upside + " pts" : null);
        }

        // Has active resume but analysis not done yet — partial credit
        return new ComponentResult(50, MAX_RESUME,
                "Resume uploaded, analysis pending",
                "Complete resume analysis to potentially add +" + (MAX_RESUME - 50) + " pts");
    }

    // ── APPLICATIONS (0..200, anti-gaming) ───────────────────────────────────

    /**
     * @param apps       non-deleted applications for the user
     * @param outcomeMap applicationId → outcomes (from application_outcomes table)
     */
    public static ComponentResult computeApplicationsScore(
            List<Application> apps,
            Map<UUID, List<ApplicationOutcome>> outcomeMap) {

        if (apps == null || apps.isEmpty()) {
            return new ComponentResult(0, MAX_APPLICATIONS,
                    "No applications yet",
                    "Submit applications to earn up to +" + MAX_APPLICATIONS + " pts");
        }

        int appliedBucket     = 0;  // hard-capped bucket for unverified "applied"
        int progressionPoints = 0;  // real progression points (uncapped per-app)

        for (Application app : apps) {
            AppStatus status = app.getCurrentStatus();
            // forwarded_email is more trustworthy than manual
            double mult = (app.getSource() == AppSource.forwarded_email) ? 1.3 : 1.0;

            int pts = progressionPoints(status);
            if (pts == 0) {
                // "applied" bucket — count but cap later
                appliedBucket += (int) Math.round(1 * mult);
            } else {
                progressionPoints += (int) Math.round(pts * mult);
            }
        }

        // Hard cap on unverified "applied" bucket (anti-gaming)
        appliedBucket = Math.min(appliedBucket, MAX_APPLIED_POINTS);

        // Outcome bonus from application_outcomes
        int outcomeBonus = 0;
        for (List<ApplicationOutcome> list : outcomeMap.values()) {
            for (ApplicationOutcome o : list) {
                outcomeBonus += outcomePoints(o.getOutcome());
            }
        }

        int total = clamp(appliedBucket + progressionPoints + outcomeBonus, 0, MAX_APPLICATIONS);
        long progressed = apps.stream()
                .filter(a -> a.getCurrentStatus() != null && a.getCurrentStatus() != AppStatus.applied)
                .count();
        String reason = String.format(
                "%d total applications: %d progressed beyond 'applied', %d applied-only (capped at %d pts)",
                apps.size(), progressed, apps.size() - progressed, MAX_APPLIED_POINTS);
        String next = total < MAX_APPLICATIONS - 30
                ? "Progress applications to interviews to add +" + (MAX_APPLICATIONS - total) + " pts" : null;

        return new ComponentResult(total, MAX_APPLICATIONS, reason, next);
    }

    /** Points per progressed status — "applied" returns 0 (handled in appliedBucket). */
    private static int progressionPoints(AppStatus s) {
        if (s == null) return 0;
        return switch (s) {
            case applied              -> 0;   // intentionally 0; goes to appliedBucket
            case pending_oa           -> 4;
            case oa_submitted         -> 6;
            case interview_scheduled  -> 8;
            case technical_round      -> 9;
            case hr_round             -> 10;
            case interview_done       -> 10;
            case shortlisted          -> 12;
            case offer_received       -> 18;
            case offer_accepted       -> 20;
            case offer_declined       -> 14;  // real offer, user declined
            case rejected             -> 2;   // shows effort
            case ghosted              -> 1;
            case withdrawn            -> 1;
        };
    }

    private static int outcomePoints(String outcome) {
        if (outcome == null) return 0;
        return switch (outcome) {
            case "offer_got"               -> 15;
            case "interview_got"           -> 8;
            case "rejected_after_interview" -> 3;
            default -> 0;
        };
    }

    // ── SKILLS (0..150, anti-gaming) ─────────────────────────────────────────

    public static ComponentResult computeSkillsScore(List<UserSkill> skills) {
        if (skills == null || skills.isEmpty()) {
            return new ComponentResult(0, MAX_SKILLS,
                    "No skills added",
                    "Add verified skills to earn up to +" + MAX_SKILLS + " pts");
        }

        int total   = 0;
        int counted = 0;
        for (UserSkill skill : skills) {
            if (counted >= MAX_SKILL_SLOTS) break;
            int prof          = skill.getProficiency() != null ? skill.getProficiency() : 1;
            boolean selfRep   = "self_reported".equalsIgnoreCase(skill.getSource());

            // Anti-gaming: self-reported claims are trusted only to proficiency 3
            if (selfRep && prof > 3) prof = 3;

            int perSlotMax = MAX_SKILLS / MAX_SKILL_SLOTS;  // 15
            total += (int) Math.round(profFraction(prof) * perSlotMax);
            counted++;
        }

        int value  = clamp(total, 0, MAX_SKILLS);
        int upside = MAX_SKILLS - value;
        int remaining = MAX_SKILL_SLOTS - counted;

        return new ComponentResult(value, MAX_SKILLS,
                String.format("%d skill(s) counted (max %d slots); self-reported capped at proficiency 3",
                        counted, MAX_SKILL_SLOTS),
                upside > 15 && remaining > 0
                        ? "Add " + remaining + " more verified skills to gain +" + upside + " pts" : null);
    }

    /**
     * Maps proficiency (1-5) to a fraction of the per-slot max.
     * Fractions deliberately non-linear so high proficiency is meaningfully rewarded.
     */
    static double profFraction(int prof) {
        return switch (prof) {
            case 1 -> 0.20;
            case 2 -> 0.45;
            case 3 -> 0.65;
            case 4 -> 0.85;
            case 5 -> 1.00;
            default -> 0.20;
        };
    }

    // ── PROFILE (0..150) ─────────────────────────────────────────────────────

    public static ComponentResult computeProfileScore(UserProfile profile) {
        if (profile == null) {
            return new ComponentResult(0, MAX_PROFILE,
                    "Profile not created",
                    "Complete your profile to earn up to +" + MAX_PROFILE + " pts");
        }

        int pct   = profile.getProfileCompletenessPct() != null ? profile.getProfileCompletenessPct() : 0;
        int value = clamp((int) Math.round(pct / 100.0 * MAX_PROFILE), 0, MAX_PROFILE);
        int upside = MAX_PROFILE - value;

        return new ComponentResult(value, MAX_PROFILE,
                String.format("Profile %d%% complete", pct),
                upside > 10 ? "Fill remaining profile fields to add +" + upside + " pts" : null);
    }

    // ── GITHUB (0..150) ──────────────────────────────────────────────────────

    public static ComponentResult computeGithubScore(UserProfile profile) {
        if (profile == null || !Boolean.TRUE.equals(profile.getGithubConnected())) {
            return new ComponentResult(0, MAX_GITHUB,
                    "GitHub not connected",
                    "Connect GitHub OR score auto-redistributes so you can still reach 1000 pts");
        }

        String data = profile.getGithubData();
        if (data == null || data.isBlank()) {
            return new ComponentResult(10, MAX_GITHUB,
                    "GitHub connected but data not synced yet",
                    "Run GitHub sync to unlock +" + (MAX_GITHUB - 10) + " more pts");
        }

        int repos = 0, followers = 0;
        try {
            JsonNode node = MAPPER.readTree(data);
            repos     = node.path("public_repos").asInt(0);
            followers = node.path("followers").asInt(0);
        } catch (Exception e) {
            return new ComponentResult(10, MAX_GITHUB, "GitHub connected (parse error)", null);
        }

        // repos (capped at 30) → 0..100 pts; followers (capped at 50) → 0..50 pts
        int repoScore     = (int) Math.round(Math.min(repos, 30) / 30.0 * 100);
        int followerScore = (int) Math.round(Math.min(followers, 50) / 50.0 * 50);
        int value         = clamp(repoScore + followerScore, 0, MAX_GITHUB);
        int repoGap       = Math.max(0, 30 - repos);

        return new ComponentResult(value, MAX_GITHUB,
                String.format("GitHub: %d public repos, %d followers", repos, followers),
                repoGap > 0 ? "Add " + repoGap + " more public repos to gain +" + (MAX_GITHUB - value) + " pts" : null);
    }

    // ── CGPA (0..100) ────────────────────────────────────────────────────────

    public static ComponentResult computeCgpaScore(UserProfile profile) {
        if (profile == null || profile.getCgpa() == null) {
            return new ComponentResult(0, MAX_CGPA,
                    "CGPA not provided",
                    "Add your CGPA to earn up to +" + MAX_CGPA + " pts");
        }

        double cgpa  = profile.getCgpa().doubleValue();
        // Heuristic: if value <= 4, treat as 4.0 scale; else 10.0 scale
        double scale = (cgpa <= 4.0) ? 4.0 : 10.0;
        int    value = clamp((int) Math.round(Math.min(cgpa / scale, 1.0) * MAX_CGPA), 0, MAX_CGPA);

        return new ComponentResult(value, MAX_CGPA,
                String.format("CGPA %.2f / %.0f", cgpa, scale),
                null);  // CGPA is historical — no actionable next step
    }

    // ── OVERALL WITH GITHUB REDISTRIBUTION ───────────────────────────────────

    /**
     * Sums all component values. If github not connected (github.value() == 0 by contract),
     * scales the 850-max sum to 1000 so non-GitHub users are never penalised.
     */
    public static int computeOverall(boolean githubConnected,
                                     ComponentResult resume, ComponentResult apps,
                                     ComponentResult skills, ComponentResult profile,
                                     ComponentResult github,  ComponentResult cgpa) {
        int raw = resume.value() + apps.value() + skills.value()
                + profile.value() + github.value() + cgpa.value();

        if (!githubConnected) {
            // github.value() == 0; scale the 850-max sub-total to 1000
            raw = (int) Math.round(raw * GITHUB_SCALE);
        }
        return Math.min(raw, 1000);
    }

    // ── BAND ─────────────────────────────────────────────────────────────────

    public static String toBand(int score) {
        if (score <= 300) return "Getting Started";
        if (score <= 500) return "Building";
        if (score <= 750) return "Strong";
        return "Placement Ready";
    }

    public static String toBandRange(String band) {
        return switch (band) {
            case "Getting Started" -> "0–300";
            case "Building"        -> "301–500";
            case "Strong"          -> "501–750";
            case "Placement Ready" -> "751–1000";
            default -> "Unknown";
        };
    }

    // ── util ─────────────────────────────────────────────────────────────────

    private static int clamp(int val, int min, int max) {
        return Math.max(min, Math.min(max, val));
    }
}
