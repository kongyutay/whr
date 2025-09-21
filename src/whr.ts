/**
 * Main WHR (Whole History Rating) implementation
 * Based on the Ruby implementation with proper mathematical corrections
 */

import { Player } from "./player";
import { Game } from "./game";
import {
    WHRConfig,
    GameResult,
    PlayerRating,
    RatingHistory,
    UnstableRatingException,
} from "./types";

export class WholeHistoryRating {
    private config: WHRConfig;
    private players: Map<string, Player>;
    private games: Game[];

    constructor(config: WHRConfig = {}) {
        this.config = {
            w2: 300.0,
            maxIterations: 50,
            tolerance: 1e-3,
            debug: false,
            prior: 1.0,
            ...config,
        };
        this.players = new Map();
        this.games = [];
    }

    /**
     * Get or create a player by name (following Ruby's player_by_name)
     */
    public playerByName(name: string): Player {
        let player = this.players.get(name);
        if (!player) {
            player = new Player(name, this.config);
            this.players.set(name, player);
        }
        return player;
    }

    /**
     * Setup a game (following Ruby's setup_game)
     */
    public setupGame(
        black: string,
        white: string,
        winner: "B" | "W" | "D",
        timeStep: number,
        handicap: number | ((game: Game) => number) = 0,
        extras: Record<string, any> = {}
    ): Game {
        // Avoid self-played games
        if (black === white) {
            throw new Error("Invalid game (black player == white player)");
        }

        const whitePlayer = this.playerByName(white);
        const blackPlayer = this.playerByName(black);
        const game = new Game(
            blackPlayer,
            whitePlayer,
            winner,
            timeStep,
            handicap,
            extras
        );

        return game;
    }

    /**
     * Create and add a game (following Ruby's create_game)
     */
    public createGame(
        black: string,
        white: string,
        winner: "B" | "W" | "D",
        timeStep: number,
        handicap: number | ((game: Game) => number) = 0,
        extras: Record<string, any> = {}
    ): Game {
        const game = this.setupGame(
            black,
            white,
            winner,
            timeStep,
            handicap,
            extras
        );
        this.addGame(game);
        return game;
    }

    /**
     * Add a game to the system (following Ruby's add_game)
     */
    public addGame(game: Game): Game {
        game.whitePlayer.addGame(game);
        game.blackPlayer.addGame(game);

        if (!game.bpd) {
            console.warn(`Bad game: ${game.toString()}`);
        }

        this.games.push(game);
        return game;
    }

    /**
     * Calculate total log likelihood
     */
    public get logLikelihood(): number {
        let score = 0.0;
        for (const player of this.players.values()) {
            if (player.days.length > 0) {
                score += player.logLikelihood;
            }
        }
        return score;
    }

    /**
     * Run one iteration of the WHR algorithm (following Ruby's run_one_iteration)
     */
    public runOneIteration(): void {
        for (const [name, player] of this.players) {
            player.runOneNewtonIteration();
        }
    }

    /**
     * Iterate the WHR algorithm (following Ruby's iterate)
     */
    public iterate(count: number): void {
        for (let i = 0; i < count; i++) {
            this.runOneIteration();
        }

        // Update uncertainties after iterations
        for (const [name, player] of this.players) {
            player.updateUncertainty();
        }
    }

    /**
     * Print ordered ratings (following Ruby's print_ordered_ratings)
     */
    public printOrderedRatings(): void {
        const playersWithDays = Array.from(this.players.values()).filter(
            (p) => p.days.length > 0
        );
        playersWithDays.sort((a, b) => {
            const aLastGamma =
                a.days.length > 0 ? a.days[a.days.length - 1].gamma : 0;
            const bLastGamma =
                b.days.length > 0 ? b.days[b.days.length - 1].gamma : 0;
            return bLastGamma - aLastGamma;
        });

        playersWithDays.forEach((player, idx) => {
            if (player.days.length > 0) {
                const eloHistory = player.days.map((d) => d.elo.toFixed(1));
                console.log(`${player.name} => [${eloHistory.join(", ")}]`);
            }
        });
    }

    /**
     * Get ratings for a specific player (following Ruby's ratings_for_player)
     */
    public ratingsForPlayer(name: string): RatingHistory {
        const player = this.playerByName(name);
        return {
            name,
            ratings: player.getRatingHistory(),
        };
    }

    /**
     * Get current ratings for all players
     */
    public getCurrentRatings(): PlayerRating[] {
        const ratings: PlayerRating[] = [];

        for (const player of this.players.values()) {
            if (player.days.length > 0) {
                const lastDay = player.days[player.days.length - 1];
                ratings.push({
                    name: player.name,
                    day: lastDay.day,
                    elo: lastDay.elo,
                    uncertainty: lastDay.uncertainty,
                });
            }
        }

        // Sort by rating (descending)
        ratings.sort((a, b) => b.elo - a.elo);

        return ratings;
    }

    /**
     * Convenience method to iterate until convergence
     */
    public iterateToConvergence(): void {
        let prevLikelihood = -Infinity;

        for (let i = 0; i < this.config.maxIterations!; i++) {
            this.runOneIteration();

            const currentLikelihood = this.logLikelihood;
            const change = Math.abs(currentLikelihood - prevLikelihood);

            if (this.config.debug) {
                console.log(
                    `Iteration ${
                        i + 1
                    }: likelihood = ${currentLikelihood}, change = ${change}`
                );
            }

            if (change < this.config.tolerance!) {
                console.log(
                    `Converged after ${i + 1} iterations (change: ${change})`
                );
                break;
            }

            prevLikelihood = currentLikelihood;

            if (i === this.config.maxIterations! - 1) {
                console.warn(
                    `Did not converge after ${this.config.maxIterations} iterations`
                );
            }
        }

        // Final uncertainty update
        for (const [name, player] of this.players) {
            player.updateUncertainty();
        }
    }

    /**
     * Get the number of players
     */
    public get playerCount(): number {
        return this.players.size;
    }

    /**
     * Get the number of games
     */
    public get gameCount(): number {
        return this.games.length;
    }

    /**
     * Clear all data
     */
    public clear(): void {
        this.players.clear();
        this.games = [];
    }

    /**
     * Legacy method for compatibility
     */
    public getPlayerByName(name: string): Player {
        return this.playerByName(name);
    }

    /**
     * Legacy method for compatibility with GameResult interface
     */
    public setupGameFromResult(gameResult: GameResult): Game {
        const {
            black,
            white,
            winner,
            timeStep,
            handicap = 0,
            extras = {},
        } = gameResult;
        return this.createGame(
            black,
            white,
            winner,
            timeStep,
            handicap,
            extras
        );
    }

    /**
     * Legacy method for compatibility
     */
    public setupGames(gameResults: GameResult[]): Game[] {
        return gameResults.map((result) => this.setupGameFromResult(result));
    }

    /**
     * Get player rating at any time point (with interpolation)
     */
    public getPlayerRatingAtTime(
        playerName: string,
        timePoint: number
    ): { elo: number; uncertainty: number } {
        const player = this.players.get(playerName);
        if (!player) {
            return { elo: 0, uncertainty: Math.sqrt(5) };
        }
        return player.getRatingAtTime(timePoint);
    }

    /**
     * Get ratings for all players at a specific time point
     */
    public getAllRatingsAtTime(
        timePoint: number
    ): Array<{ name: string; elo: number; uncertainty: number }> {
        const ratings: Array<{
            name: string;
            elo: number;
            uncertainty: number;
        }> = [];

        for (const [name, player] of this.players) {
            const rating = player.getRatingAtTime(timePoint);
            ratings.push({ name, ...rating });
        }

        // Sort by rating (descending)
        ratings.sort((a, b) => b.elo - a.elo);

        return ratings;
    }
}
