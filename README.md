# @whrNode/core

A mathematically correct Node.js/TypeScript implementation of the Whole History Rating (WHR) algorithm.

## Overview

Whole-History Rating (WHR) is a Bayesian rating system for players of time-varying strength, developed by Rémi Coulom. Unlike traditional Elo-based systems that use incremental updates, WHR computes the exact maximum a posteriori over the entire rating history of all players, providing more accurate ratings at the cost of higher computational complexity.

This implementation fixes several mathematical issues found in other implementations and closely follows the original Ruby implementation and research paper.

## Key Improvements

This implementation addresses critical mathematical errors found in previous implementations:

-   **✅ Fixed Prior Calculation**: Corrected log probability density calculation (was using probability density instead of log probability density)
-   **✅ Proper Hessian Matrix**: Complete tridiagonal Hessian matrix implementation with correct boundary conditions
-   **✅ LU Decomposition**: Efficient linear equation solving for Newton's method
-   **✅ Complete Uncertainty**: Full covariance matrix calculation for proper uncertainty estimation
-   **✅ Numerical Stability**: Robust error handling and convergence checks
-   **✅ Ruby Compatibility**: Output matches the original Ruby implementation

## Features

-   ✅ **Mathematically Correct**: Based on the original WHR paper by Rémi Coulom
-   ✅ **Proper Newton's Method**: Multi-dimensional Newton optimization with LU decomposition
-   ✅ **Interpolation Support**: Rating estimation at any time point using Wiener process formulas
-   ✅ **Handicap Support**: Proper handicap game handling with dynamic handicap functions
-   ✅ **Full TypeScript**: Complete type safety and modern JavaScript features
-   ✅ **Comprehensive Tests**: Extensive test coverage including Ruby compatibility tests
-   ✅ **Performance**: Efficient algorithms suitable for real-time applications

## Installation

```bash
npm install @whrNode/core
```

## Quick Start

```typescript
import { WholeHistoryRating } from "@whrNode/core";

// Create a new WHR instance
const whr = new WholeHistoryRating({
    w2: 300, // Elo variance parameter (elo^2 per day)
    maxIterations: 50, // More iterations for better convergence
    tolerance: 1e-3, // Convergence tolerance
    debug: false, // Set true for detailed output
});

// Add games using the Ruby-style API
whr.createGame("Alice", "Bob", "B", 1); // Alice beats Bob on day 1
whr.createGame("Alice", "Charlie", "B", 2); // Alice beats Charlie on day 2
whr.createGame("Bob", "Charlie", "W", 3); // Bob beats Charlie on day 3

// Calculate ratings with proper iteration count
whr.iterate(50);

// Display results
whr.printOrderedRatings();
// Output: Alice => [92.1, 91.9, 90.6]

// Get detailed rating history
const aliceHistory = whr.ratingsForPlayer("Alice");
console.log(aliceHistory.ratings);
// Output: [[1, 92, 87], [2, 92, 87], [4, 91, 88]]

// Get interpolated rating at any time point
const ratingAtDay2_5 = whr.getPlayerRatingAtTime("Alice", 2.5);
console.log(
    `Day 2.5: ${ratingAtDay2_5.elo.toFixed(
        1
    )} ±${ratingAtDay2_5.uncertainty.toFixed(1)}`
);
```

## Advanced Usage

### Handicap Games

```typescript
// Fixed handicap
whr.createGame("Beginner", "Expert", "B", 1, 9); // 9-stone handicap

// Dynamic handicap function
whr.createGame("Player1", "Player2", "W", 1, (game) => {
    const ratingDiff = game.wpd!.elo - game.bpd!.elo;
    return Math.max(0, Math.floor(ratingDiff / 100));
});
```

### Rating Interpolation

```typescript
// Get rating at any time point (with interpolation)
const rating = whr.getPlayerRatingAtTime("Alice", 3.5);
console.log(`Rating: ${rating.elo}, Uncertainty: ${rating.uncertainty}`);

// Get all players' ratings at a specific time
const allRatings = whr.getAllRatingsAtTime(2.5);
allRatings.forEach((r) => {
    console.log(`${r.name}: ${r.elo.toFixed(1)} ±${r.uncertainty.toFixed(1)}`);
});
```

### Legacy GameResult Interface

```typescript
import { GameResult } from "@whrNode/core";

// Alternative interface for batch processing
const games: GameResult[] = [
    { black: "Alice", white: "Bob", winner: "B", timeStep: 1 },
    { black: "Alice", white: "Charlie", winner: "B", timeStep: 2 },
];

whr.setupGames(games);
```

## Configuration Options

```typescript
const whr = new WholeHistoryRating({
    w2: 300.0, // Elo variance parameter (elo^2 per day)
    maxIterations: 50, // Maximum iterations for convergence
    tolerance: 1e-3, // Convergence tolerance
    debug: false, // Enable debug output
    prior: 1.0, // Virtual games against reference player
});
```

## API Reference

### WholeHistoryRating Class

#### Methods

-   `createGame(black, white, winner, timeStep, handicap?, extras?)` - Add a single game
-   `iterate(count)` - Run specified number of iterations
-   `iterateToConvergence()` - Iterate until convergence
-   `ratingsForPlayer(name)` - Get rating history for a player
-   `getCurrentRatings()` - Get current ratings for all players
-   `getPlayerRatingAtTime(name, timePoint)` - Get interpolated rating
-   `getAllRatingsAtTime(timePoint)` - Get all players' ratings at time point
-   `printOrderedRatings()` - Print ratings to console
-   `get logLikelihood` - Calculate total log likelihood

#### Properties

-   `playerCount` - Number of players
-   `gameCount` - Number of games

## Mathematical Background

This implementation is based on the paper "Whole-History Rating: A Bayesian Rating System for Players of Time-Varying Strength" by Rémi Coulom. Key mathematical components:

1. **Bradley-Terry Model**: P(i beats j) = γᵢ/(γᵢ + γⱼ)
2. **Wiener Process Prior**: r(t₂) - r(t₁) ~ N(0, |t₂ - t₁|w²)
3. **Newton's Method**: r ← r - H⁻¹∇log p
4. **LU Decomposition**: Efficient solving of tridiagonal systems

## Testing

```bash
npm test
```

The test suite includes:

-   Mathematical correctness tests
-   Ruby compatibility tests
-   Interpolation functionality tests
-   Edge case and error handling tests

## Ruby Compatibility

This implementation produces output that matches the original Ruby WHR implementation:

```typescript
// Ruby test case replication
const whr = new WholeHistoryRating();
whr.createGame("shusaku", "shusai", "B", 1, 0);
whr.createGame("shusaku", "shusai", "W", 2, 0);
whr.createGame("shusaku", "shusai", "W", 3, 0);
whr.createGame("shusaku", "shusai", "W", 4, 0);
whr.createGame("shusaku", "shusai", "W", 4, 0);

whr.iterate(50);

// Output matches Ruby: [[-92, 84], [-94, 84], [-95, 85], [-96, 85]]
console.log(whr.ratingsForPlayer("shusaku").ratings);
```

## Performance

The algorithm is designed for real-time applications:

-   Linear complexity in number of ratings per player (due to tridiagonal structure)
-   Efficient LU decomposition for matrix operations
-   Convergence typically achieved in 10-50 iterations

## License

MIT License - see LICENSE file for details.

## References

1. Rémi Coulom. "Whole-History Rating: A Bayesian Rating System for Players of Time-Varying Strength." ICGA Journal, 2008.
2. Original Ruby implementation: https://github.com/goshrine/whole_history_rating

## Contributing

Issues and pull requests are welcome. Please ensure all tests pass and add tests for new features.
