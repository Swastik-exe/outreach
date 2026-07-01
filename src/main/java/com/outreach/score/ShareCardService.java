package com.outreach.score;

import com.outreach.profile.UserProfile;
import com.outreach.profile.UserProfileRepository;
import com.outreach.score.dto.CohortInsightResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.UUID;

/**
 * Server-side PNG share cards — only the requesting user's own score/band/progress.
 */
@Service
@RequiredArgsConstructor
public class ShareCardService {

    private static final int W = 1200;
    private static final int H = 630;
    private static final Color BG = new Color(11, 15, 26);
    private static final Color ACCENT = new Color(99, 102, 241);
    private static final Color TEXT = new Color(248, 250, 252);
    private static final Color MUTED = new Color(148, 163, 184);

    private final CareerHealthScoreRepository scoreRepository;
    private final CareerHealthHistoryRepository historyRepository;
    private final CohortService cohortService;
    private final UserProfileRepository profileRepository;

    public enum Variant { SCORE, PROGRESS }

    @Transactional(readOnly = true)
    public byte[] render(UUID userId, Variant variant) {
        CareerHealthScore score = scoreRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("No score for user"));
        UserProfile profile = profileRepository.findByUserId(userId).orElse(null);
        String role = profile != null && profile.getTargetRole() != null
                ? formatRole(profile.getTargetRole()) : "Career";

        int overall = score.getOverallScore() != null ? score.getOverallScore() : 0;
        String band = score.getBand() != null ? score.getBand() : ScoreComponents.toBand(overall);

        CohortInsightResponse cohort = cohortService.getCohortInsight(userId);
        String cohortLine = cohort.available()
                ? cohort.band() + " in your cohort"
                : null;

        Integer weeklyDelta = null;
        if (variant == Variant.PROGRESS) {
            weeklyDelta = computeWeeklyDelta(userId, overall);
        }

        return drawCard(overall, band, role, cohortLine, weeklyDelta, variant);
    }

    private int computeWeeklyDelta(UUID userId, int current) {
        LocalDate weekAgo = LocalDate.now().minusDays(7);
        return historyRepository.findByUserIdAndRecordedDate(userId, weekAgo)
                .map(h -> current - (h.getOverallScore() != null ? h.getOverallScore() : 0))
                .orElse(0);
    }

    private byte[] drawCard(int score, String band, String role,
                            String cohortLine, Integer weeklyDelta, Variant variant) {
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            g.setColor(BG);
            g.fillRect(0, 0, W, H);

            g.setColor(new Color(ACCENT.getRed(), ACCENT.getGreen(), ACCENT.getBlue(), 40));
            g.fill(new Ellipse2D.Double(W - 280, -80, 360, 360));

            g.setFont(new Font("SansSerif", Font.BOLD, 28));
            g.setColor(ACCENT);
            g.drawString("Outreach", 64, 72);

            g.setFont(new Font("SansSerif", Font.PLAIN, 18));
            g.setColor(MUTED);
            g.drawString("Career Readiness", 64, 102);

            if (variant == Variant.PROGRESS && weeklyDelta != null) {
                g.setFont(new Font("SansSerif", Font.BOLD, 64));
                g.setColor(weeklyDelta >= 0 ? new Color(52, 211, 153) : new Color(248, 113, 113));
                String deltaStr = (weeklyDelta >= 0 ? "+" : "") + weeklyDelta + " this week";
                g.drawString(deltaStr, 64, 220);

                g.setFont(new Font("SansSerif", Font.PLAIN, 32));
                g.setColor(TEXT);
                g.drawString("Score now: " + score + " / 1000", 64, 290);
            } else {
                g.setFont(new Font("SansSerif", Font.BOLD, 96));
                g.setColor(TEXT);
                g.drawString(String.valueOf(score), 64, 240);

                g.setFont(new Font("SansSerif", Font.PLAIN, 36));
                g.setColor(MUTED);
                g.drawString("/ 1000", 64 + g.getFontMetrics().stringWidth(String.valueOf(score)) + 12, 240);
            }

            g.setFont(new Font("SansSerif", Font.BOLD, 40));
            g.setColor(ACCENT);
            g.drawString(band, 64, 340);

            g.setFont(new Font("SansSerif", Font.PLAIN, 28));
            g.setColor(MUTED);
            g.drawString(role, 64, 390);

            if (cohortLine != null) {
                g.drawString(cohortLine, 64, 440);
            }

            g.setFont(new Font("SansSerif", Font.ITALIC, 16));
            g.setColor(new Color(MUTED.getRed(), MUTED.getGreen(), MUTED.getBlue(), 180));
            g.drawString("Your data only — no rankings of others", 64, H - 48);
            g.drawString("outreach.dev", W - 180, H - 48);

        } finally {
            g.dispose();
        }

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to render share card PNG", e);
        }
    }

    private String formatRole(String role) {
        return Arrays.stream(role.split("_"))
                .map(w -> w.isEmpty() ? w : Character.toUpperCase(w.charAt(0)) + w.substring(1))
                .reduce((a, b) -> a + " " + b)
                .orElse(role);
    }
}
