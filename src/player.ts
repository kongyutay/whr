/**
 * Represents a player in the WHR system
 * Based on the Ruby implementation's Player class with proper mathematical implementation
 */

import { PlayerDay } from "./player-day";
import { WHRConfig, UnstableRatingException } from "./types";
import { Game } from "./game";

export class Player {
    public name: string;
    public days: PlayerDay[];
    public anchorGamma?: number;
    public w2: number; // Converted w2 parameter (r^2, not elo^2)
    public debug: boolean;
    public id?: string;

    constructor(name: string, config: WHRConfig = {}) {
        this.name = name;
        this.debug = config.debug || false;

        // Convert from elo^2 to r^2 as per Ruby implementation
        const w2Elo = config.w2 || 300.0;
        this.w2 = Math.pow((Math.sqrt(w2Elo) * Math.log(10)) / 400, 2);

        this.days = [];
    }

    /**
     * Calculate log likelihood including correct prior calculation
     */
    public get logLikelihood(): number {
        let sum = 0.0;
        const sigma2 = this.computeSigma2();
        const n = this.days.length;

        for (let i = 0; i < n; i++) {
            let prior = 0.0;

            // Calculate prior probability density (FIXED: use log probability density)
            if (i < n - 1) {
                const rd = this.days[i].r - this.days[i + 1].r;
                // CORRECT: log probability density, not probability density
                prior +=
                    (-0.5 * (rd * rd)) / sigma2[i] -
                    0.5 * Math.log(2 * Math.PI * sigma2[i]);
            }
            if (i > 0) {
                const rd = this.days[i].r - this.days[i - 1].r;
                // CORRECT: log probability density, not probability density
                prior +=
                    (-0.5 * (rd * rd)) / sigma2[i - 1] -
                    0.5 * Math.log(2 * Math.PI * sigma2[i - 1]);
            }

            const dayLikelihood = this.days[i].logLikelihood;

            if (!isFinite(dayLikelihood) || !isFinite(prior)) {
                console.warn(
                    `Infinity at ${this.name}: dayLikelihood=${dayLikelihood}, prior=${prior}`
                );
                continue;
            }

            if (prior === 0) {
                sum += dayLikelihood;
            } else {
                sum += dayLikelihood + prior;
            }
        }

        return sum;
    }

    /**
     * Compute sigma squared for Wiener process prior
     */
    private computeSigma2(): number[] {
        const sigma2: number[] = [];
        for (let i = 0; i < this.days.length - 1; i++) {
            const d1 = this.days[i];
            const d2 = this.days[i + 1];
            sigma2.push(Math.abs(d2.day - d1.day) * this.w2);
        }
        return sigma2;
    }

    /**
     * Build Hessian matrix (tridiagonal)
     */
    private hessian(days: PlayerDay[], sigma2: number[]): number[][] {
        const n = days.length;
        const h: number[][] = Array(n)
            .fill(null)
            .map(() => Array(n).fill(0));

        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                if (row === col) {
                    // Diagonal elements
                    let prior = 0;
                    if (row < n - 1) prior += -1.0 / sigma2[row];
                    if (row > 0) prior += -1.0 / sigma2[row - 1];
                    h[row][col] =
                        days[row].logLikelihoodSecondDerivative + prior - 0.001;
                } else if (row === col - 1) {
                    // Super-diagonal
                    h[row][col] = 1.0 / sigma2[row];
                } else if (row === col + 1) {
                    // Sub-diagonal
                    h[row][col] = 1.0 / sigma2[col];
                }
                // All other elements remain 0
            }
        }

        return h;
    }

    /**
     * Compute gradient vector
     */
    private gradient(
        r: number[],
        days: PlayerDay[],
        sigma2: number[]
    ): number[] {
        const g: number[] = [];
        const n = days.length;

        for (let idx = 0; idx < n; idx++) {
            let prior = 0;
            if (idx < n - 1) {
                prior += -(r[idx] - r[idx + 1]) / sigma2[idx];
            }
            if (idx > 0) {
                prior += -(r[idx] - r[idx - 1]) / sigma2[idx - 1];
            }

            if (this.debug) {
                console.log(
                    `g[${idx}] = ${days[idx].logLikelihoodDerivative} + ${prior}`
                );
            }

            g.push(days[idx].logLikelihoodDerivative + prior);
        }

        return g;
    }

    /**
     * Run one Newton iteration using proper n-dimensional Newton's method with LU decomposition
     */
    public runOneNewtonIteration(): void {
        // Clear cached game terms
        for (const day of this.days) {
            day.clearGameTermsCache();
        }

        if (this.days.length === 1) {
            this.days[0].updateBy1DNewtonsMethod();
        } else if (this.days.length > 1) {
            this.updateByNDimNewton();
        }
    }

    /**
     * Update using n-dimensional Newton's method with LU decomposition
     */
    private updateByNDimNewton(): void {
        const r = this.days.map((day) => day.r);
        const n = r.length;

        if (this.debug) {
            console.log(`Updating ${this.name}`);
            for (let i = 0; i < this.days.length; i++) {
                const day = this.days[i];
                console.log(`day[${day.day}] r = ${day.r}`);
                console.log(`day[${day.day}] log(p) = ${day.logLikelihood}`);
                console.log(
                    `day[${day.day}] dlp = ${day.logLikelihoodDerivative}`
                );
                console.log(
                    `day[${day.day}] dlp2 = ${day.logLikelihoodSecondDerivative}`
                );
            }
        }

        const sigma2 = this.computeSigma2();
        const h = this.hessian(this.days, sigma2);
        const g = this.gradient(r, this.days, sigma2);

        // LU decomposition for tridiagonal matrix
        const { a, d, b } = this.luDecompositionTridiagonal(h, n);

        // Forward substitution: Ly = g
        const y: number[] = [g[0]];
        for (let i = 1; i < n; i++) {
            y[i] = g[i] - a[i] * y[i - 1];
        }

        // Back substitution: Ux = y
        const x: number[] = Array(n);
        x[n - 1] = y[n - 1] / d[n - 1];
        for (let i = n - 2; i >= 0; i--) {
            x[i] = (y[i] - b[i] * x[i + 1]) / d[i];
        }

        const newR = r.map((ri, i) => ri - x[i]);

        // Check for stability
        for (const newRi of newR) {
            if (newRi > 650) {
                throw new UnstableRatingException(
                    `Unstable r (${newR}) on player ${this.name}`
                );
            }
        }

        if (this.debug) {
            console.log(`${this.name} (${r}) => (${newR})`);
        }

        // Update ratings
        for (let i = 0; i < this.days.length; i++) {
            this.days[i].r = newR[i];
        }
    }

    /**
     * LU decomposition for tridiagonal matrix
     */
    private luDecompositionTridiagonal(
        h: number[][],
        n: number
    ): { a: number[]; d: number[]; b: number[] } {
        const a: number[] = Array(n);
        const d: number[] = [h[0][0]];
        const b: number[] = Array(n);

        if (n > 0) b[0] = h[0][1];

        for (let i = 1; i < n; i++) {
            a[i] = h[i][i - 1] / d[i - 1];
            d[i] = h[i][i] - a[i] * b[i - 1];
            if (i < n - 1) {
                b[i] = h[i][i + 1];
            }
        }

        return { a, d, b };
    }

    /**
     * Calculate covariance matrix for uncertainty estimation
     */
    public covariance(): number[][] {
        const r = this.days.map((day) => day.r);
        const sigma2 = this.computeSigma2();
        const h = this.hessian(this.days, sigma2);
        const n = this.days.length;

        // Implement proper covariance calculation
        const { a, d, b } = this.luDecompositionTridiagonal(h, n);

        // Calculate diagonal and sub-diagonal terms of H^-1
        const dp: number[] = Array(n);
        const bp: number[] = Array(n);
        const ap: number[] = Array(n);

        dp[n - 1] = h[n - 1][n - 1];
        if (n > 1) bp[n - 1] = h[n - 1][n - 2];

        for (let i = n - 2; i >= 0; i--) {
            ap[i] = h[i][i + 1] / dp[i + 1];
            dp[i] = h[i][i] - ap[i] * bp[i + 1];
            if (i > 0) bp[i] = h[i][i - 1];
        }

        const v: number[] = Array(n);
        for (let i = 0; i < n - 1; i++) {
            v[i] = dp[i + 1] / (b[i] * bp[i + 1] - d[i] * dp[i + 1]);
        }
        v[n - 1] = -1 / d[n - 1];

        // Build covariance matrix
        const cov: number[][] = Array(n)
            .fill(null)
            .map(() => Array(n).fill(0));
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                if (row === col) {
                    cov[row][col] = v[row];
                } else if (row === col - 1) {
                    cov[row][col] = -a[col] * v[col];
                }
                // All other elements remain 0
            }
        }

        return cov;
    }

    /**
     * Update uncertainty estimates
     */
    public updateUncertainty(): void {
        if (this.days.length > 0) {
            const c = this.covariance();
            for (let i = 0; i < this.days.length; i++) {
                this.days[i].uncertainty = Math.sqrt(Math.abs(c[i][i]));
            }
        }
    }

    /**
     * Add a game to this player
     */
    public addGame(game: Game): void {
        // Find or create player day
        let newPday: PlayerDay;
        if (
            this.days.length === 0 ||
            this.days[this.days.length - 1].day !== game.day
        ) {
            newPday = new PlayerDay(this, game.day);
            if (this.days.length === 0) {
                newPday.isFirstDay = true;
                newPday.gamma = 1;
            } else {
                newPday.gamma = this.days[this.days.length - 1].gamma;
            }
            this.days.push(newPday);
        } else {
            newPday = this.days[this.days.length - 1];
        }

        // Set player day references in game
        if (game.whitePlayer === this) {
            game.wpd = newPday;
        } else {
            game.bpd = newPday;
        }

        // Add game to player day
        newPday.addGame(game);
    }

    /**
     * Get rating history as array of [day, elo, uncertainty] tuples
     */
    public getRatingHistory(): Array<[number, number, number]> {
        return this.days.map((day) => [
            day.day,
            Math.round(day.elo),
            Math.round(day.uncertainty * 100),
        ]);
    }

    /**
     * Get the current rating (most recent day)
     */
    public get currentRating(): number {
        if (this.days.length === 0) {
            return 0;
        }
        return this.days[this.days.length - 1].elo;
    }

    /**
     * Get the current uncertainty
     */
    public get currentUncertainty(): number {
        if (this.days.length === 0) {
            return 5;
        }
        return this.days[this.days.length - 1].uncertainty;
    }

    /**
     * Interpolate rating at a given time point using Wiener process formulas
     * Based on Appendix C of the WHR paper
     */
    public interpolateRating(timePoint: number): {
        elo: number;
        uncertainty: number;
    } {
        if (this.days.length === 0) {
            return { elo: 0, uncertainty: Math.sqrt(5) };
        }

        if (this.days.length === 1) {
            const day = this.days[0];
            const timeDiff = Math.abs(timePoint - day.day);
            const variance =
                day.uncertainty * day.uncertainty + timeDiff * this.w2;
            return { elo: day.elo, uncertainty: Math.sqrt(variance) };
        }

        // Find surrounding days
        let t1Index = -1,
            t2Index = -1;

        for (let i = 0; i < this.days.length - 1; i++) {
            if (
                this.days[i].day <= timePoint &&
                this.days[i + 1].day >= timePoint
            ) {
                t1Index = i;
                t2Index = i + 1;
                break;
            }
        }

        if (t1Index === -1) {
            // Outside the range, use nearest endpoint
            if (timePoint < this.days[0].day) {
                const day = this.days[0];
                const timeDiff = day.day - timePoint;
                const variance =
                    day.uncertainty * day.uncertainty + timeDiff * this.w2;
                return { elo: day.elo, uncertainty: Math.sqrt(variance) };
            } else {
                const day = this.days[this.days.length - 1];
                const timeDiff = timePoint - day.day;
                const variance =
                    day.uncertainty * day.uncertainty + timeDiff * this.w2;
                return { elo: day.elo, uncertainty: Math.sqrt(variance) };
            }
        }

        const t1 = this.days[t1Index];
        const t2 = this.days[t2Index];

        // Linear interpolation for mean (μ)
        const mu1 = t1.r; // Natural rating
        const mu2 = t2.r;
        const mu =
            (mu1 * (t2.day - timePoint) + mu2 * (timePoint - t1.day)) /
            (t2.day - t1.day);

        // Interpolation for variance (σ²) using Appendix C formula
        const sigma1Sq = t1.uncertainty * t1.uncertainty;
        const sigma2Sq = t2.uncertainty * t2.uncertainty;
        const sigma12 = 0; // Simplified: assume no covariance for now

        const varianceFromProcess =
            (((t2.day - timePoint) * (timePoint - t1.day)) /
                (t2.day - t1.day)) *
            this.w2;
        const varianceFromUncertainty =
            (Math.pow(t2.day - timePoint, 2) * sigma1Sq +
                2 * (t2.day - timePoint) * (timePoint - t1.day) * sigma12 +
                Math.pow(timePoint - t1.day, 2) * sigma2Sq) /
            Math.pow(t2.day - t1.day, 2);

        const totalVariance = varianceFromProcess + varianceFromUncertainty;

        // Convert back to Elo
        const elo = (mu * 400.0) / Math.log(10);
        const uncertainty = Math.sqrt(Math.max(0, totalVariance));

        return { elo, uncertainty };
    }

    /**
     * Get rating at any time point (with interpolation)
     */
    public getRatingAtTime(timePoint: number): {
        elo: number;
        uncertainty: number;
    } {
        // Check if we have exact data for this time point
        const exactDay = this.days.find((d) => d.day === timePoint);
        if (exactDay) {
            return { elo: exactDay.elo, uncertainty: exactDay.uncertainty };
        }

        // Use interpolation
        return this.interpolateRating(timePoint);
    }

    /**
     * String representation
     */
    public toString(): string {
        return `Player(${this.name})`;
    }
}
