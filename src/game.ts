/**
 * Represents a game between two players
 * Based on the Ruby implementation's Game class
 */

import { Player } from "./player";
import { PlayerDay } from "./player-day";
import { UnstableRatingException } from "./types";

export class Game {
    public day: number;
    public whitePlayer: Player;
    public blackPlayer: Player;
    public handicap: number;
    public winner: "B" | "W" | "D";
    public wpd: PlayerDay | null = null; // White player day
    public bpd: PlayerDay | null = null; // Black player day
    public extras: Record<string, any>;

    private handicapProc: ((game: Game) => number) | null = null;

    constructor(
        blackPlayer: Player,
        whitePlayer: Player,
        winner: "B" | "W" | "D",
        timeStep: number,
        handicap: number | ((game: Game) => number) = 0,
        extras: Record<string, any> = {}
    ) {
        this.day = timeStep;
        this.whitePlayer = whitePlayer;
        this.blackPlayer = blackPlayer;
        this.winner = winner;
        this.extras = extras;

        if (typeof handicap === "function") {
            this.handicapProc = handicap;
            this.handicap = 0; // Will be calculated dynamically
        } else {
            this.handicap = handicap || 0;
        }
    }

    /**
     * Get opponent's adjusted gamma for Bradley-Terry calculation
     */
    public opponentsAdjustedGamma(player: Player): number {
        const blackAdvantage = this.handicapProc
            ? this.handicapProc(this)
            : this.handicap;

        let opponentElo: number;

        if (player === this.whitePlayer) {
            if (!this.bpd)
                throw new Error(
                    `No black player day found for game: ${this.toString()}`
                );
            opponentElo = this.bpd.elo + blackAdvantage;
        } else if (player === this.blackPlayer) {
            if (!this.wpd)
                throw new Error(
                    `No white player day found for game: ${this.toString()}`
                );
            opponentElo = this.wpd.elo - blackAdvantage;
        } else {
            throw new Error(
                `No opponent for ${
                    player.name
                }, since they're not in this game: ${this.toString()}`
            );
        }

        const rval = Math.pow(10, opponentElo / 400.0);

        if (rval === 0 || !isFinite(rval) || isNaN(rval)) {
            throw new UnstableRatingException(
                `Bad adjusted gamma: ${this.toString()}`
            );
        }

        return rval;
    }

    /**
     * Get the opponent of the specified player
     */
    public opponent(player: Player): Player | null {
        if (player === this.whitePlayer) {
            return this.blackPlayer;
        } else if (player === this.blackPlayer) {
            return this.whitePlayer;
        }
        return null;
    }

    /**
     * Calculate prediction score for this game
     */
    public get predictionScore(): number {
        if (this.whiteWinProbability === 0.5) {
            return 0.5;
        } else {
            return (this.winner === "W" && this.whiteWinProbability > 0.5) ||
                (this.winner === "B" && this.whiteWinProbability < 0.5)
                ? 1.0
                : 0.0;
        }
    }

    /**
     * Bradley-Terry model: White win probability
     */
    public get whiteWinProbability(): number {
        if (!this.wpd) throw new Error("White player day not set");
        return (
            this.wpd.gamma /
            (this.wpd.gamma + this.opponentsAdjustedGamma(this.whitePlayer))
        );
    }

    /**
     * Bradley-Terry model: Black win probability
     */
    public get blackWinProbability(): number {
        if (!this.bpd) throw new Error("Black player day not set");
        return (
            this.bpd.gamma /
            (this.bpd.gamma + this.opponentsAdjustedGamma(this.blackPlayer))
        );
    }

    /**
     * Check if this game involves the specified player
     */
    public involvesPlayer(player: Player): boolean {
        return this.blackPlayer === player || this.whitePlayer === player;
    }

    /**
     * Get a string representation of this game
     */
    public toString(): string {
        const handicapStr = this.handicap > 0 ? ` (H${this.handicap})` : "";
        const wpdR = this.wpd ? this.wpd.r.toFixed(2) : "?";
        const bpdR = this.bpd ? this.bpd.r.toFixed(2) : "?";
        return `W:${this.whitePlayer.name}(r=${wpdR}) B:${this.blackPlayer.name}(r=${bpdR}) winner=${this.winner}, handicap=${this.handicap}${handicapStr}`;
    }
}
