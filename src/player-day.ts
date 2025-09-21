/**
 * Represents a player's rating on a specific day
 * Based on the Ruby implementation's PlayerDay class
 */

import { GameTerm } from "./types";
import { Game } from "./game";

export class PlayerDay {
    public day: number;
    public player: any; // Reference to parent player
    public r: number; // Natural rating (ln(gamma))
    public isFirstDay: boolean;
    public uncertainty: number;
    public wonGames: Game[];
    public lostGames: Game[];

    // Cached game terms
    private _wonGameTerms: GameTerm[] | null = null;
    private _lostGameTerms: GameTerm[] | null = null;

    constructor(player: any, day: number) {
        this.day = day;
        this.player = player;
        this.r = 0; // Natural rating starts at 0 (gamma = 1)
        this.isFirstDay = false;
        this.uncertainty = Math.sqrt(5); // Initial uncertainty
        this.wonGames = [];
        this.lostGames = [];
    }

    /**
     * Get gamma value from natural rating
     */
    public get gamma(): number {
        return Math.exp(this.r);
    }

    /**
     * Set gamma value (updates natural rating)
     */
    public set gamma(value: number) {
        this.r = Math.log(value);
    }

    /**
     * Get Elo rating from natural rating
     */
    public get elo(): number {
        return (this.r * 400.0) / Math.log(10);
    }

    /**
     * Set Elo rating (updates natural rating)
     */
    public set elo(value: number) {
        this.r = (value * Math.log(10)) / 400.0;
    }

    /**
     * Clear cached game terms
     */
    public clearGameTermsCache(): void {
        this._wonGameTerms = null;
        this._lostGameTerms = null;
    }

    /**
     * Add a game to this day
     */
    public addGame(game: Game): void {
        if (
            (game.winner === "W" && game.whitePlayer === this.player) ||
            (game.winner === "B" && game.blackPlayer === this.player)
        ) {
            this.wonGames.push(game);
        } else {
            this.lostGames.push(game);
        }
    }

    /**
     * Get won game terms for Bradley-Terry model
     */
    public get wonGameTerms(): GameTerm[] {
        if (this._wonGameTerms === null) {
            this._wonGameTerms = this.wonGames.map((game) => {
                const otherGamma = game.opponentsAdjustedGamma(this.player);
                if (
                    otherGamma === 0 ||
                    !isFinite(otherGamma) ||
                    isNaN(otherGamma)
                ) {
                    console.warn(
                        `Invalid other_gamma: ${otherGamma} for opponent ${
                            game.opponent(this.player)?.name
                        }`
                    );
                }
                return { a: 1.0, b: 0.0, c: 1.0, d: otherGamma };
            });

            // Add virtual game for first day
            if (this.isFirstDay) {
                this._wonGameTerms.push({ a: 1.0, b: 0.0, c: 1.0, d: 1.0 });
            }
        }
        return this._wonGameTerms;
    }

    /**
     * Get lost game terms for Bradley-Terry model
     */
    public get lostGameTerms(): GameTerm[] {
        if (this._lostGameTerms === null) {
            this._lostGameTerms = this.lostGames.map((game) => {
                const otherGamma = game.opponentsAdjustedGamma(this.player);
                if (
                    otherGamma === 0 ||
                    !isFinite(otherGamma) ||
                    isNaN(otherGamma)
                ) {
                    console.warn(
                        `Invalid other_gamma: ${otherGamma} for opponent ${
                            game.opponent(this.player)?.name
                        }`
                    );
                }
                return { a: 0.0, b: otherGamma, c: 1.0, d: otherGamma };
            });

            // Add virtual game for first day
            if (this.isFirstDay) {
                this._lostGameTerms.push({ a: 0.0, b: 1.0, c: 1.0, d: 1.0 });
            }
        }
        return this._lostGameTerms;
    }

    /**
     * Calculate log likelihood for this day
     */
    public get logLikelihood(): number {
        let tally = 0.0;

        // Won games contribution
        for (const term of this.wonGameTerms) {
            tally += Math.log(term.a * this.gamma);
            tally -= Math.log(term.c * this.gamma + term.d);
        }

        // Lost games contribution
        for (const term of this.lostGameTerms) {
            tally += Math.log(term.b);
            tally -= Math.log(term.c * this.gamma + term.d);
        }

        return tally;
    }

    /**
     * Calculate first derivative of log likelihood
     */
    public get logLikelihoodDerivative(): number {
        let tally = 0.0;
        const allTerms = [...this.wonGameTerms, ...this.lostGameTerms];

        for (const term of allTerms) {
            tally += term.c / (term.c * this.gamma + term.d);
        }

        return this.wonGameTerms.length - this.gamma * tally;
    }

    /**
     * Calculate second derivative of log likelihood
     */
    public get logLikelihoodSecondDerivative(): number {
        let sum = 0.0;
        const allTerms = [...this.wonGameTerms, ...this.lostGameTerms];

        for (const term of allTerms) {
            sum +=
                (term.c * term.d) / Math.pow(term.c * this.gamma + term.d, 2);
        }

        if (isNaN(this.gamma) || isNaN(sum)) {
            console.warn("NaN detected in second derivative calculation");
            console.warn(`wonGameTerms: ${JSON.stringify(this.wonGameTerms)}`);
            console.warn(
                `lostGameTerms: ${JSON.stringify(this.lostGameTerms)}`
            );
        }

        return -this.gamma * sum;
    }

    /**
     * Update rating using 1D Newton's method (for single day players)
     */
    public updateBy1DNewtonsMethod(): void {
        const dlogp = this.logLikelihoodDerivative;
        const d2logp = this.logLikelihoodSecondDerivative;

        if (Math.abs(d2logp) < 1e-10) {
            return; // Avoid division by zero
        }

        const dr = dlogp / d2logp;
        const newR = this.r - dr;

        this.r = newR;
    }

    /**
     * Clone this PlayerDay
     */
    public clone(): PlayerDay {
        const cloned = new PlayerDay(this.player, this.day);
        cloned.r = this.r;
        cloned.isFirstDay = this.isFirstDay;
        cloned.uncertainty = this.uncertainty;
        cloned.wonGames = [...this.wonGames];
        cloned.lostGames = [...this.lostGames];
        return cloned;
    }
}
