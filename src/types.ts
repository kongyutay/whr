/**
 * Type definitions for WHR algorithm
 */

export interface WHRConfig {
    /** Elo variance parameter (default: 300.0) - elo^2 per day */
    w2?: number;
    /** Maximum iterations for convergence (default: 50) */
    maxIterations?: number;
    /** Convergence tolerance (default: 1e-3) */
    tolerance?: number;
    /** Debug mode (default: false) */
    debug?: boolean;
    /** Prior wins/losses against virtual player (default: 1.0) */
    prior?: number;
}

export interface GameResult {
    /** Name/ID of the black player */
    black: string;
    /** Name/ID of the white player */
    white: string;
    /** Winner: 'B' for black, 'W' for white, 'D' for draw */
    winner: "B" | "W" | "D";
    /** Time step (day) when the game was played */
    timeStep: number;
    /** Handicap stones (default: 0) */
    handicap?: number;
    /** Additional game metadata */
    extras?: Record<string, any>;
}

export interface PlayerRating {
    /** Player name/ID */
    name: string;
    /** Time step (day) */
    day: number;
    /** Elo rating */
    elo: number;
    /** Rating uncertainty */
    uncertainty: number;
}

export interface RatingHistory {
    /** Player name/ID */
    name: string;
    /** Array of [day, elo, uncertainty] tuples */
    ratings: Array<[number, number, number]>;
}

export class UnstableRatingException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnstableRatingException";
    }
}

/** Game term for Bradley-Terry model calculation */
export interface GameTerm {
    /** A coefficient */
    a: number;
    /** B coefficient */
    b: number;
    /** C coefficient */
    c: number;
    /** D coefficient (opponent's gamma) */
    d: number;
}
