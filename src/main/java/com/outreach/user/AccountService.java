package com.outreach.user;

import com.outreach.billing.SubscriptionService;
import com.outreach.common.exception.BadRequestException;
import com.outreach.resume.Resume;
import com.outreach.resume.ResumeRepository;
import com.outreach.resume.storage.FileStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.UUID;

/**
 * Coordinates irreversible account cleanup across external providers, object
 * storage, and the database. External cleanup happens first so a deleted user
 * can never keep accruing subscription charges or leave resume PDFs behind.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserRepository userRepository;
    private final ResumeRepository resumeRepository;
    private final FileStorage fileStorage;
    private final SubscriptionService subscriptionService;

    @Transactional
    public void deleteAccount(UUID userId) {
        if (!userRepository.existsById(userId)) {
            return;
        }

        for (Resume resume : resumeRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            deleteStoredResume(resume);
        }

        subscriptionService.cancelForAccountDeletion(userId);
        userRepository.deleteById(userId);
        userRepository.flush();
        log.info("Account and owned data permanently deleted for user {}", userId);
    }

    private void deleteStoredResume(Resume resume) {
        String fileUrl = resume.getFileUrl();
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }

        String key = FileStorage.keyFromLocation(fileUrl);
        if (key.isBlank()) {
            return;
        }

        try {
            fileStorage.delete(key);
        } catch (IOException e) {
            log.error("Account deletion could not remove stored resume {} for user {}",
                    resume.getId(), resume.getUser().getId(), e);
            throw new BadRequestException(
                    "Could not remove all stored files. Your account was not deleted; please try again.");
        }
    }
}
