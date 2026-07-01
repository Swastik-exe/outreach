package com.outreach.billing;

/** Mirrors the PostgreSQL enum: sub_status. */
public enum SubStatus {
    active, expired, cancelled, past_due
}
