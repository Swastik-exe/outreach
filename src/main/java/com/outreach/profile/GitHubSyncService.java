package com.outreach.profile;

import com.outreach.common.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

/**
 * Fetches public GitHub user data via GitHub REST API v3.
 * Stored as JSON in user_profiles.github_data (JSONB).
 * Only public data — no OAuth token required for public profiles.
 */
@Slf4j
@Service
public class GitHubSyncService {

    private final RestClient restClient;

    public GitHubSyncService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.restClient = RestClient.builder()
                .baseUrl("https://api.github.com")
                .defaultHeader("Accept", "application/vnd.github.v3+json")
                .defaultHeader("User-Agent", "outreach-app/1.0")
                .requestFactory(factory)
                .build();
    }

    /**
     * Fetches the raw JSON payload for a GitHub username.
     * @return raw JSON string to store in github_data JSONB column
     */
    public String fetchUserData(String githubUsername) {
        if (githubUsername == null || githubUsername.isBlank()) {
            throw new BadRequestException("GitHub username is required");
        }
        try {
            String response = restClient.get()
                    .uri("/users/{username}", githubUsername)
                    .retrieve()
                    .body(String.class);
            log.info("GitHub sync success for username={}", githubUsername);
            return response;
        } catch (RestClientException e) {
            log.warn("GitHub sync failed for username={}: {}", githubUsername, e.getMessage());
            throw new BadRequestException("Could not fetch GitHub data for username: " + githubUsername);
        }
    }
}
