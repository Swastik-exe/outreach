package com.outreach.auth;

/** Mirrors the PostgreSQL enum: auth_provider. Constants are lowercase to match DB values exactly. */
public enum AuthProvider {
    local, google, github
}
