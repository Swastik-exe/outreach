package com.outreach.tracker.dto;

/**
 * Returned by POST /applications.
 * When possibleDuplicate=true, the application was NOT created;
 * existingMatch contains the fuzzy-matched application.
 * Re-POST with ?force=true to bypass the dedup check.
 */
public record CreateApplicationResult(
        ApplicationResponse application,
        boolean possibleDuplicate,
        ApplicationResponse existingMatch
) {}
