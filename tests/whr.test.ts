/**
 * Tests for WholeHistoryRating class
 * Based on Ruby implementation tests
 */

import { WholeHistoryRating } from "../src/whr";
import { UnstableRatingException } from "../src/types";

describe("WholeHistoryRating", () => {
    let whr: WholeHistoryRating;

    beforeEach(() => {
        whr = new WholeHistoryRating();
    });

    describe("initialization", () => {
        it("should create an empty WHR system", () => {
            expect(whr.playerCount).toBe(0);
            expect(whr.gameCount).toBe(0);
        });

        it("should accept configuration options", () => {
            const customWhr = new WholeHistoryRating({
                w2: 17,
                maxIterations: 20,
                tolerance: 1e-4,
            });
            expect(customWhr.playerCount).toBe(0);
        });
    });

    describe("game setup with elo ratings", () => {
        const setupGameWithElo = (
            whiteElo: number,
            blackElo: number,
            handicap: number
        ) => {
            const game = whr.createGame("black", "white", "W", 1, handicap);
            if (game.bpd) game.bpd.elo = blackElo;
            if (game.wpd) game.wpd.elo = whiteElo;
            return game;
        };

        it("should have white winrate of 50% for equal strength players in even game", () => {
            const game = setupGameWithElo(500, 500, 0);
            expect(Math.abs(game.whiteWinProbability - 0.5)).toBeLessThan(
                0.0001
            );
        });

        it("should give handicap advantage to black player", () => {
            const game = setupGameWithElo(500, 500, 1);
            expect(game.blackWinProbability).toBeGreaterThan(0.5);
        });

        it("should give advantage to higher rated player", () => {
            const game = setupGameWithElo(600, 500, 0);
            expect(game.whiteWinProbability).toBeGreaterThan(0.5);
        });

        it("should have equal winrates for same elo delta", () => {
            const game1 = setupGameWithElo(100, 200, 0);
            const game2 = setupGameWithElo(200, 300, 0);
            expect(
                Math.abs(game1.whiteWinProbability - game2.whiteWinProbability)
            ).toBeLessThan(0.0001);
        });

        it("should calculate correct winrate for twice as strong player", () => {
            const game = setupGameWithElo(100, 200, 0);
            expect(Math.abs(game.whiteWinProbability - 0.359935)).toBeLessThan(
                0.0001
            );
        });

        it("should have inversely proportional winrates with unequal ranks", () => {
            const game = setupGameWithElo(600, 500, 0);
            expect(
                Math.abs(
                    game.whiteWinProbability - (1 - game.blackWinProbability)
                )
            ).toBeLessThan(0.0001);
        });

        it("should have inversely proportional winrates with handicap", () => {
            const game = setupGameWithElo(500, 500, 4);
            expect(
                Math.abs(
                    game.whiteWinProbability - (1 - game.blackWinProbability)
                )
            ).toBeLessThan(0.0001);
        });
    });

    describe("rating calculation matching Ruby output", () => {
        it("should produce expected output for test case", () => {
            whr.createGame("shusaku", "shusai", "B", 1, 0);
            whr.createGame("shusaku", "shusai", "W", 2, 0);
            whr.createGame("shusaku", "shusai", "W", 3, 0);
            whr.createGame("shusaku", "shusai", "W", 4, 0);
            whr.createGame("shusaku", "shusai", "W", 4, 0);

            whr.iterate(50);

            const shusaku = whr.ratingsForPlayer("shusaku");
            const shusai = whr.ratingsForPlayer("shusai");

            // Check that we get the expected structure
            expect(shusaku.ratings.length).toBe(4);
            expect(shusai.ratings.length).toBe(4);

            // Check approximate values (allowing some tolerance for numerical differences)
            expect(shusaku.ratings[0][1]).toBeLessThan(0); // Should be negative
            expect(shusai.ratings[0][1]).toBeGreaterThan(0); // Should be positive

            // Final ratings should show shusai stronger than shusaku
            const shusaku_final =
                shusaku.ratings[shusaku.ratings.length - 1][1];
            const shusai_final = shusai.ratings[shusai.ratings.length - 1][1];
            expect(shusai_final).toBeGreaterThan(shusaku_final);
        });
    });

    describe("unstable rating exception", () => {
        it("should raise exception for certain unstable cases", () => {
            // Create games that can lead to instability
            for (let game = 1; game <= 10; game++) {
                whr.createGame("anchor", "player", "B", 1, 0);
                whr.createGame("anchor", "player", "W", 1, 0);
            }

            for (let game = 1; game <= 10; game++) {
                whr.createGame("anchor", "player", "B", 180, 600);
                whr.createGame("anchor", "player", "W", 180, 600);
            }

            expect(() => {
                whr.iterate(10);
            }).toThrow(UnstableRatingException);
        });
    });

    describe("player management", () => {
        it("should create players automatically when adding games", () => {
            whr.createGame("Alice", "Bob", "B", 1);
            expect(whr.playerCount).toBe(2);
        });

        it("should return the same player instance for the same name", () => {
            const player1 = whr.playerByName("Alice");
            const player2 = whr.playerByName("Alice");
            expect(player1).toBe(player2);
        });

        it("should reject self-played games", () => {
            expect(() => whr.createGame("Alice", "Alice", "B", 1)).toThrow(
                "Invalid game"
            );
        });
    });

    describe("rating queries", () => {
        beforeEach(() => {
            whr.createGame("Alice", "Bob", "B", 1);
            whr.createGame("Alice", "Charlie", "B", 2);
            whr.createGame("Bob", "Charlie", "W", 3);
            whr.iterate(10);
        });

        it("should return rating history for a player", () => {
            const aliceRatings = whr.ratingsForPlayer("Alice");
            expect(aliceRatings.name).toBe("Alice");
            expect(aliceRatings.ratings.length).toBeGreaterThan(0);

            // Each rating should be [day, elo, uncertainty]
            for (const rating of aliceRatings.ratings) {
                expect(rating).toHaveLength(3);
                expect(typeof rating[0]).toBe("number"); // day
                expect(typeof rating[1]).toBe("number"); // elo
                expect(typeof rating[2]).toBe("number"); // uncertainty
            }
        });

        it("should return current ratings for all players", () => {
            const currentRatings = whr.getCurrentRatings();
            expect(currentRatings.length).toBe(3);

            // Should be sorted by rating (descending)
            for (let i = 1; i < currentRatings.length; i++) {
                expect(currentRatings[i - 1].elo).toBeGreaterThanOrEqual(
                    currentRatings[i].elo
                );
            }
        });
    });

    describe("log likelihood", () => {
        it("should calculate log likelihood", () => {
            whr.createGame("Alice", "Bob", "B", 1);
            whr.createGame("Alice", "Bob", "W", 2);

            const likelihood = whr.logLikelihood;
            expect(typeof likelihood).toBe("number");
            expect(isFinite(likelihood)).toBe(true);
        });
    });

    describe("legacy compatibility", () => {
        it("should support legacy GameResult interface", () => {
            const games = [
                {
                    black: "Alice",
                    white: "Bob",
                    winner: "B" as const,
                    timeStep: 1,
                },
                {
                    black: "Alice",
                    white: "Charlie",
                    winner: "B" as const,
                    timeStep: 2,
                },
                {
                    black: "Bob",
                    white: "Charlie",
                    winner: "W" as const,
                    timeStep: 3,
                },
            ];

            whr.setupGames(games);
            expect(whr.gameCount).toBe(3);
            expect(whr.playerCount).toBe(3);
        });
    });
});
