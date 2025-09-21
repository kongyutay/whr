/**
 * Basic usage example for @whrNode/core
 * Demonstrates the corrected WHR implementation
 */

import { WholeHistoryRating } from "../src/index";

// Create a new WHR instance with proper configuration
const whr = new WholeHistoryRating({
    w2: 300, // Elo variance parameter (elo^2 per day)
    maxIterations: 50,
    tolerance: 1e-3,
    debug: false, // Set to true for detailed output
});

console.log("🎯 Whole History Rating Demo");
console.log("============================\n");

// Sample game data using the Ruby-style API
console.log("Adding games...");
whr.createGame("Alice", "Bob", "B", 1); // Alice beats Bob on day 1
whr.createGame("Alice", "Charlie", "B", 2); // Alice beats Charlie on day 2
whr.createGame("Bob", "Charlie", "W", 3); // Bob beats Charlie on day 3
whr.createGame("Alice", "Bob", "W", 4); // Bob beats Alice on day 4
whr.createGame("Bob", "Charlie", "B", 5); // Charlie beats Bob on day 5
whr.createGame("Alice", "Charlie", "B", 6); // Alice beats Charlie on day 6

console.log(`Added ${whr.gameCount} games with ${whr.playerCount} players\n`);

// Calculate ratings using proper iteration
console.log("Calculating ratings...");
whr.iterate(50); // Run 50 iterations

// Display current ratings
console.log("\n📊 Final Ratings:");
whr.printOrderedRatings();

// Get detailed rating history for a specific player
console.log("\n📈 Alice's rating history:");
const aliceHistory = whr.ratingsForPlayer("Alice");
aliceHistory.ratings.forEach(([day, elo, uncertainty]) => {
    console.log(`  Day ${day}: ${elo.toFixed(1)} ±${uncertainty.toFixed(1)}`);
});

// Calculate log likelihood
const likelihood = whr.logLikelihood;
console.log(`\n📊 Log likelihood: ${likelihood.toFixed(4)}`);

// Demonstrate handicap game
console.log("\n🎮 Adding a handicap game...");
whr.createGame("Beginner", "Expert", "B", 7, 9); // 9-stone handicap game
whr.iterate(10);

console.log("\n📊 Updated ratings with handicap game:");
whr.printOrderedRatings();

// Test the Ruby compatibility by replicating the Ruby test case
console.log("\n🧪 Ruby compatibility test:");
const testWhr = new WholeHistoryRating();
testWhr.createGame("shusaku", "shusai", "B", 1, 0);
testWhr.createGame("shusaku", "shusai", "W", 2, 0);
testWhr.createGame("shusaku", "shusai", "W", 3, 0);
testWhr.createGame("shusaku", "shusai", "W", 4, 0);
testWhr.createGame("shusaku", "shusai", "W", 4, 0);

testWhr.iterate(50);

console.log("Shusaku ratings:", testWhr.ratingsForPlayer("shusaku").ratings);
console.log("Shusai ratings:", testWhr.ratingsForPlayer("shusai").ratings);

// Demonstrate interpolation functionality
console.log("\n🔮 Interpolation Demo:");
console.log(
    "Alice played on days 1, 2, 4, 6. Let's see her rating on day 3.5:"
);
const interpolatedRating = whr.getPlayerRatingAtTime("Alice", 3.5);
console.log(
    `Day 3.5: ${interpolatedRating.elo.toFixed(
        1
    )} ±${interpolatedRating.uncertainty.toFixed(1)}`
);

console.log("\nAll players' ratings on day 2.5:");
const allRatingsDay2_5 = whr.getAllRatingsAtTime(2.5);
allRatingsDay2_5.forEach((rating) => {
    console.log(
        `  ${rating.name}: ${rating.elo.toFixed(
            1
        )} ±${rating.uncertainty.toFixed(1)}`
    );
});

console.log("\n✅ Demo completed successfully!");
