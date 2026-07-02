package com.outreach.auth;

import org.junit.jupiter.api.Test;

import static com.outreach.auth.AuthController.normalizeFrontendUrl;
import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthControllerUrlTest {

    @Test
    void addsHttpsWhenSchemeMissing() {
        assertEquals("https://outreach-iota-ruddy.vercel.app",
                normalizeFrontendUrl("outreach-iota-ruddy.vercel.app"));
    }

    @Test
    void stripsTrailingSlash() {
        assertEquals("https://app.example.com",
                normalizeFrontendUrl("https://app.example.com/"));
    }
}
