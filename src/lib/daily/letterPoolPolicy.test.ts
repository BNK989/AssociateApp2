import { describe, expect, it } from 'vitest';
import { LETTER_POOL } from '@/lib/gameConfig';
import { DEFAULT_LETTER_POOL_POLICY, parseLetterPoolPolicy } from './letterPoolPolicy';

describe('DEFAULT_LETTER_POOL_POLICY', () => {
    // The floor the whole design rests on: a database that never receives the
    // migration must play exactly as the compiled code does.
    it('reproduces the compiled constant rather than restating it', () => {
        expect(DEFAULT_LETTER_POOL_POLICY.caretSkipsGreens).toBe(LETTER_POOL.CARET_SKIPS_GREENS);
    });
});

describe('parseLetterPoolPolicy', () => {
    it('reads a stored value', () => {
        expect(parseLetterPoolPolicy({ caretSkipsGreens: false }).caretSkipsGreens).toBe(false);
        expect(parseLetterPoolPolicy({ caretSkipsGreens: true }).caretSkipsGreens).toBe(true);
    });

    // The seeded row is `{}` on purpose, so it cannot drift from gameConfig.
    it('treats an empty object as the compiled defaults', () => {
        expect(parseLetterPoolPolicy({})).toEqual(DEFAULT_LETTER_POOL_POLICY);
    });

    it('falls back rather than coercing a non-boolean', () => {
        for (const value of ['true', 1, 0, null, []]) {
            expect(parseLetterPoolPolicy({ caretSkipsGreens: value }))
                .toEqual(DEFAULT_LETTER_POOL_POLICY);
        }
    });

    it('survives anything that is not a policy at all', () => {
        for (const value of [null, undefined, 'nope', 42, []]) {
            expect(parseLetterPoolPolicy(value)).toEqual(DEFAULT_LETTER_POOL_POLICY);
        }
    });
});
