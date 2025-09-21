/**
 * Tests for Player class
 * Updated to match the new Ruby-based implementation
 */

import { Player } from "../src/player";
import { Game } from "../src/game";
import { WHRConfig } from "../src/types";

describe("Player", () => {
    let player: Player;

    beforeEach(() => {
        player = new Player("TestPlayer");
    });

    describe("initialization", () => {
        it("should create a player with a name", () => {
            expect(player.name).toBe("TestPlayer");
            expect(player.days).toHaveLength(0);
        });

        it("should accept configuration", () => {
            const config: WHRConfig = { w2: 500, debug: true };
            const configuredPlayer = new Player("ConfiguredPlayer", config);
            expect(configuredPlayer.name).toBe("ConfiguredPlayer");
            expect(configuredPlayer.debug).toBe(true);
        });

        it("should convert w2 parameter correctly", () => {
            const config: WHRConfig = { w2: 300 };
            const configuredPlayer = new Player("ConfiguredPlayer", config);
            // w2 should be converted from elo^2 to r^2
            expect(configuredPlayer.w2).toBeCloseTo(
                Math.pow((Math.sqrt(300) * Math.log(10)) / 400, 2)
            );
        });
    });

    describe("game management", () => {
        it("should add games and create player days", () => {
            const otherPlayer = new Player("OtherPlayer");
            const game = new Game(player, otherPlayer, "B", 1, 0);

            player.addGame(game);
            otherPlayer.addGame(game);

            expect(player.days).toHaveLength(1);
            expect(player.days[0].day).toBe(1);
            expect(player.days[0].isFirstDay).toBe(true);
        });

        it("should reuse existing player day for same time step", () => {
            const otherPlayer = new Player("OtherPlayer");
            const game1 = new Game(player, otherPlayer, "B", 1, 0);
            const game2 = new Game(player, otherPlayer, "W", 1, 0);

            player.addGame(game1);
            otherPlayer.addGame(game1);
            player.addGame(game2);
            otherPlayer.addGame(game2);

            expect(player.days).toHaveLength(1);
            expect(player.days[0].wonGames).toHaveLength(1);
            expect(player.days[0].lostGames).toHaveLength(1);
        });

        it("should create separate days for different time steps", () => {
            const otherPlayer = new Player("OtherPlayer");
            const game1 = new Game(player, otherPlayer, "B", 1, 0);
            const game2 = new Game(player, otherPlayer, "W", 3, 0);

            player.addGame(game1);
            otherPlayer.addGame(game1);
            player.addGame(game2);
            otherPlayer.addGame(game2);

            expect(player.days).toHaveLength(2);
            expect(player.days[0].day).toBe(1);
            expect(player.days[1].day).toBe(3);
        });
    });

    describe("rating calculations", () => {
        beforeEach(() => {
            const otherPlayer = new Player("OtherPlayer");
            const game = new Game(player, otherPlayer, "B", 1, 0);
            player.addGame(game);
            otherPlayer.addGame(game);
        });

        it("should calculate log likelihood", () => {
            const likelihood = player.logLikelihood;
            expect(typeof likelihood).toBe("number");
            expect(isFinite(likelihood)).toBe(true);
        });

        it("should run Newton iteration", () => {
            const initialR = player.days[0].r;
            player.runOneNewtonIteration();
            // Rating should potentially change (though might be minimal for single iteration)
            expect(typeof player.days[0].r).toBe("number");
        });

        it("should update uncertainty", () => {
            player.updateUncertainty();
            expect(player.days[0].uncertainty).toBeGreaterThan(0);
            expect(isFinite(player.days[0].uncertainty)).toBe(true);
        });
    });

    describe("rating properties", () => {
        beforeEach(() => {
            const otherPlayer = new Player("OtherPlayer");
            const game = new Game(player, otherPlayer, "B", 1, 0);
            player.addGame(game);
        });

        it("should provide current rating", () => {
            const rating = player.currentRating;
            expect(typeof rating).toBe("number");
            expect(isFinite(rating)).toBe(true);
        });

        it("should provide current uncertainty", () => {
            const uncertainty = player.currentUncertainty;
            expect(typeof uncertainty).toBe("number");
            expect(uncertainty).toBeGreaterThan(0);
        });

        it("should return rating history", () => {
            const history = player.getRatingHistory();
            expect(history).toHaveLength(1);
            expect(history[0]).toHaveLength(3); // [day, elo, uncertainty]
            expect(history[0][0]).toBe(1); // day
            expect(typeof history[0][1]).toBe("number"); // elo
            expect(typeof history[0][2]).toBe("number"); // uncertainty
        });
    });

    describe("covariance calculation", () => {
        it("should calculate covariance matrix for multiple days", () => {
            const otherPlayer = new Player("OtherPlayer");
            const game1 = new Game(player, otherPlayer, "B", 1, 0);
            const game2 = new Game(player, otherPlayer, "W", 2, 0);

            player.addGame(game1);
            otherPlayer.addGame(game1);
            player.addGame(game2);
            otherPlayer.addGame(game2);

            const cov = player.covariance();
            expect(cov).toHaveLength(2);
            expect(cov[0]).toHaveLength(2);
            expect(cov[1]).toHaveLength(2);

            // Diagonal elements should be positive (variances)
            expect(cov[0][0]).toBeGreaterThan(0);
            expect(cov[1][1]).toBeGreaterThan(0);
        });
    });

    describe("string representation", () => {
        it("should return proper string representation", () => {
            const str = player.toString();
            expect(str).toBe("Player(TestPlayer)");
        });
    });
});
