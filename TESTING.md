# Testing Guide

This project uses [Vitest](https://vitest.dev/) for unit and integration testing.

## Running Tests

To run the test suite, use the following commands:

```bash
# Run tests once
npm test

# Run tests in watch mode (interactive)
npx vitest
```

## Test Structure

-   **Unit Tests**: Located alongside source files (e.g., `src/lib/gameLogic.test.ts`). These test individual functions and logic in isolation.
-   **Configuration**: `vitest.config.ts` in the root directory.

## What is Tested?

Currently, we have unit tests covering the core game logic:
-   **Scoring**: `calculateMessageValue`
-   **Fuzzy Matching**: `calculateSimilarity`
-   **Cipher Generation**: `generateCipherString` (ensuring hints work as expected)

## Adding New Tests

1.  Create a file named `*.test.ts` or `*.test.tsx` next to the component or logic you want to test.
2.  Import `describe`, `it`, `expect` from `vitest`.
3.  Write your test cases.

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFunction';

describe('myFunction', () => {
    it('should work correctly', () => {
        expect(myFunction(1)).toBe(2);
    });
});
```
