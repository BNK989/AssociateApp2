import { describe, it, expect } from 'vitest';
import {
    DAILY_EPOCH,
    buildShareText,
    countSolved,
    dailyPuzzleNumber,
    gridFor,
    squareFor,
    summarizeChain,
    type ChainEntry,
} from './dailyShare';
import { MAX_STRIKES } from './dailyScoring';

const GREEN = '\u{1F7E9}';
const YELLOW = '\u{1F7E8}';
const WHITE = '⬜';

function solved(hintLevel = 0): ChainEntry {
    return { is_solved: true, hint_level: hintLevel, strikes: 0, winner_points: 42 };
}

const gaveUp: ChainEntry = { is_solved: true, hint_level: 1, strikes: 0, winner_points: 0 };
const struckOut: ChainEntry = { is_solved: true, hint_level: 3, strikes: MAX_STRIKES, winner_points: 0 };
const startWord: ChainEntry = { is_solved: true, hint_level: 0, strikes: 0, winner_points: 0 };

describe('dailyPuzzleNumber', () => {
    it('counts the first ever chain as #1', () => {
        expect(dailyPuzzleNumber(DAILY_EPOCH)).toBe(1);
    });

    it('advances by one per day, across months and years', () => {
        expect(dailyPuzzleNumber('2025-12-29')).toBe(2);
        expect(dailyPuzzleNumber('2026-01-01')).toBe(5);
        expect(dailyPuzzleNumber('2026-08-22')).toBe(238);
    });
});

describe('squareFor', () => {
    it('greens a word solved without help', () => {
        expect(squareFor(solved(0))).toBe('clean');
    });

    it('yellows a word solved after a hint', () => {
        expect(squareFor(solved(1))).toBe('hinted');
        expect(squareFor(solved(3))).toBe('hinted');
    });

    it('whites a word given up on', () => {
        // is_solved is true here -- it means "left the board", not "guessed".
        expect(squareFor(gaveUp)).toBe('missed');
    });

    it('whites a word struck out', () => {
        expect(squareFor(struckOut)).toBe('missed');
    });

    it('whites a word never reached', () => {
        expect(squareFor({})).toBe('missed');
    });
});

describe('summarizeChain', () => {
    it('drops the final word, which is revealed for free', () => {
        const squares = summarizeChain([solved(0), solved(1), gaveUp, startWord]);

        expect(squares).toHaveLength(3);
        expect(squares).toEqual(['clean', 'hinted', 'missed']);
    });

    it('returns nothing for a chain of only the free word', () => {
        expect(summarizeChain([startWord])).toEqual([]);
        expect(summarizeChain([])).toEqual([]);
    });
});

describe('gridFor', () => {
    it('renders one glyph per square, in chain order', () => {
        expect(gridFor(['clean', 'hinted', 'missed'])).toBe(`${GREEN}${YELLOW}${WHITE}`);
    });

    it('renders nothing for no squares', () => {
        expect(gridFor([])).toBe('');
    });
});

describe('countSolved', () => {
    it('counts greens and yellows, but not whites', () => {
        expect(countSolved(['clean', 'hinted', 'missed', 'clean'])).toBe(3);
    });
});

describe('buildShareText', () => {
    const url = 'https://associ8game.com/daily';

    it('puts the grid on its own line and the link after a blank one', () => {
        const text = buildShareText({
            headline: 'Associ8 #238 - 3/4',
            squares: ['clean', 'hinted', 'missed'],
            url,
        });

        expect(text).toBe(`Associ8 #238 - 3/4\n${GREEN}${YELLOW}${WHITE}\n\n${url}`);
    });

    it('includes a streak line when there is one', () => {
        const text = buildShareText({
            headline: 'Associ8 #238 - 4/4',
            squares: ['clean'],
            streakLine: '3 day streak',
            url,
        });

        expect(text.split('\n')[2]).toBe('3 day streak');
    });

    it('gives away no word, hint, or theme', () => {
        const text = buildShareText({
            headline: 'Associ8 #238 - 3/4',
            squares: summarizeChain([solved(0), solved(1), gaveUp, startWord]),
            url,
        });

        // The whole point of the grid: it says how the day went, not what it was.
        for (const secret of ['Pipe', 'Backyard Campout', 'Metal tube']) {
            expect(text).not.toContain(secret);
        }

        // Nothing beyond the caller's own headline and the link is prose --
        // the middle of the message is squares and nothing else.
        const [, grid] = text.split('\n');
        expect(grid).toMatch(/^[\u{1F7E8}\u{1F7E9}⬜]+$/u);
    });
});
