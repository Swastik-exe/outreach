package com.outreach.tracker;

/** Mirrors the PostgreSQL enum: app_status. 'follow_up_due' intentionally omitted (D1 fix). */
public enum AppStatus {
    applied, pending_oa, oa_submitted, interview_scheduled, interview_done,
    technical_round, hr_round, shortlisted, offer_received, offer_accepted,
    offer_declined, rejected, ghosted, withdrawn
}
