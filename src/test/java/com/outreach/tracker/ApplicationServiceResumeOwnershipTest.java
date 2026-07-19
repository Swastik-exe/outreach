package com.outreach.tracker;

import com.outreach.common.exception.NotFoundException;
import com.outreach.resume.ResumeRepository;
import com.outreach.score.CareerHealthScoreRepository;
import com.outreach.score.ScoreService;
import com.outreach.tracker.dto.CreateApplicationRequest;
import com.outreach.tracker.dto.UpdateApplicationRequest;
import com.outreach.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceResumeOwnershipTest {

    @Mock private ApplicationRepository appRepo;
    @Mock private ApplicationTimelineRepository timelineRepo;
    @Mock private ApplicationOutcomeRepository outcomeRepo;
    @Mock private UserRepository userRepo;
    @Mock private ResumeRepository resumeRepo;
    @Mock private CareerHealthScoreRepository scoreRepo;
    @Mock private ScoreService scoreService;

    private ApplicationService service;

    private final UUID userA = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private final UUID userBResume = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    @BeforeEach
    void setUp() {
        service = new ApplicationService(
                appRepo, timelineRepo, outcomeRepo, userRepo, resumeRepo, scoreRepo, scoreService);
    }

    @Test
    void create_rejectsForeignResumeId() {
        when(appRepo.findFuzzyDuplicate(any(), any(), any())).thenReturn(Optional.empty());
        when(resumeRepo.findByIdAndUser_Id(userBResume, userA)).thenReturn(Optional.empty());

        CreateApplicationRequest req = new CreateApplicationRequest(
                "Acme", "SDE", "manual", LocalDate.of(2026, 1, 15),
                null, userBResume, null, "medium");

        assertThrows(NotFoundException.class, () -> service.create(userA, req, false));
        verify(appRepo, never()).save(any());
    }

    @Test
    void update_rejectsForeignResumeId() {
        UUID appId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        Application owned = Application.builder()
                .id(appId)
                .company("Acme")
                .companyCanonical("acme")
                .role("SDE")
                .roleCanonical("sde")
                .appliedDate(LocalDate.of(2026, 1, 15))
                .currentStatus(AppStatus.applied)
                .build();
        when(appRepo.findByIdAndUserId(appId, userA)).thenReturn(Optional.of(owned));
        when(resumeRepo.findByIdAndUser_Id(userBResume, userA)).thenReturn(Optional.empty());

        UpdateApplicationRequest req = new UpdateApplicationRequest(
                null, null, null, null, userBResume, null, null, null, null, null, null);

        assertThrows(NotFoundException.class, () -> service.update(appId, userA, req));
        verify(appRepo, never()).save(any());
    }
}
