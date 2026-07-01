package com.outreach.resume;

import org.apache.tika.metadata.Metadata;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ResumeParserTest {

    @Test
    void rejectsGarbageTextBelowWordThreshold() {
        // 120+ chars but only a handful of tokens — old 100-char threshold would pass
        String garbage = "xkjqpw mztnrf bvcxdl qwhjks plmnbv cxzqwe rtkjhg fdsapq wertyu "
                + "zxcvbn mkjhgf dsapoi lkjhgf";
        assertTrue(ResumeParser.looksLikeScannedOrGarbage(garbage, new Metadata()));
    }

    @Test
    void acceptsRealisticResumeSnippet() {
        String resume = """
                John Doe
                Software Engineer with 3 years of experience in Java, Spring Boot, and PostgreSQL.
                Built scalable REST APIs serving 10k daily users. B.Tech Computer Science, IIT Delhi.
                Skills: Java, Python, Docker, Kubernetes, AWS, system design, data structures.
                Led a team of four engineers on a placement tracker product used by 500 students.
                """;
        assertFalse(ResumeParser.looksLikeScannedOrGarbage(resume.strip(), new Metadata()));
    }

    @Test
    void rejectsLowDensityMultiPageText() {
        Metadata meta = new Metadata();
        meta.set("xmpTPg:NPages", "5");
        String sparse = "word ".repeat(30).strip(); // ~150 chars, 30 words, 5 pages
        assertTrue(ResumeParser.looksLikeScannedOrGarbage(sparse, meta));
    }
}
