package com.outreach.common;



import lombok.extern.slf4j.Slf4j;

import org.springframework.boot.ApplicationArguments;

import org.springframework.boot.ApplicationRunner;

import org.springframework.stereotype.Component;



import java.util.ArrayList;

import java.util.List;



/**

 * Fails fast at startup if any required environment variable is missing or blank,

 * printing a clear list of offenders before the JVM exits.

 */

@Slf4j

@Component

@org.springframework.context.annotation.Profile("!test")

public class StartupValidator implements ApplicationRunner {



    private static final List<String> REQUIRED_ALWAYS = List.of(

            "DATABASE_URL",

            "DATABASE_USERNAME",

            "DATABASE_PASSWORD",

            "REDIS_HOST",

            "REDIS_PORT",

            "JWT_SECRET",

            "FRONTEND_URL"

    );



    /** Additional vars required when SPRING_PROFILES_ACTIVE contains "prod". */

    private static final List<String> REQUIRED_PROD = List.of(

            "CORS_ALLOWED_ORIGINS",

            "INBOUND_WEBHOOK_SECRET",

            "RESEND_API_KEY",

            "R2_ACCOUNT_ID",

            "R2_ACCESS_KEY",

            "R2_SECRET_KEY",

            "R2_BUCKET",

            "REDIS_PASSWORD",

            "RAZORPAY_KEY_ID",

            "RAZORPAY_KEY_SECRET",

            "RAZORPAY_WEBHOOK_SECRET"

    );



    @Override

    public void run(ApplicationArguments args) {

        List<String> missing = new ArrayList<>();



        for (String key : REQUIRED_ALWAYS) {

            if (isBlank(System.getenv(key))) {

                missing.add(key);

            }

        }



        if (isProd()) {

            for (String key : REQUIRED_PROD) {

                if (isBlank(System.getenv(key))) {

                    missing.add(key);

                }

            }

            if (isBlank(System.getenv("GEMINI_API_KEY")) && isBlank(System.getenv("GROQ_API_KEY"))) {

                missing.add("GEMINI_API_KEY or GROQ_API_KEY (at least one required in prod)");

            }

            String cookieSecure = System.getenv("COOKIE_SECURE");

            if (cookieSecure == null || !cookieSecure.equalsIgnoreCase("true")) {

                missing.add("COOKIE_SECURE=true (required in prod)");

            }

        }



        if (!missing.isEmpty()) {

            log.error("====================================================");

            log.error("STARTUP FAILED — missing required environment variables:");

            missing.forEach(k -> log.error("  • {}", k));

            log.error("Copy .env.example to .env and populate all values.");

            log.error("See DEPLOY-CHECKLIST.md for where to get each key.");

            log.error("====================================================");

            throw new IllegalStateException(

                    "Missing required env vars: " + String.join(", ", missing));

        }



        log.info("StartupValidator: all required environment variables are present.");

    }



    private static boolean isProd() {

        String profile = System.getenv("SPRING_PROFILES_ACTIVE");

        return profile != null && profile.contains("prod");

    }



    private static boolean isBlank(String value) {

        return value == null || value.isBlank();

    }

}

