package com.outreach.score;

/**
 * Immutable result of a single score component calculation.
 * {@link #upside()} drives which component generates the top-level next_action.
 */
public record ComponentResult(int value, int max, String reason, String nextAction) {

    /** Points still obtainable in this component. */
    public int upside() {
        return max - value;
    }
}
