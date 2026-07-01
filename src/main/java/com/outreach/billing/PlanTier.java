package com.outreach.billing;

/** Mirrors the PostgreSQL enum: plan_tier. Constants are lowercase to match DB values exactly. */
public enum PlanTier {
    free, pass_holder, premium, admin
}
