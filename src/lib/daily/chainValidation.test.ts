import { describe, it, expect } from 'vitest';
import { themesAreTooSimilar, validateChain, type ChainHistory, type GeneratedChain } from './chainValidation';
import { DOMAINS, ANGLES, type DayPlan } from './themeWheel';

const plan: DayPlan = {
    playDate: '2026-09-01',
    domain: DOMAINS[0],
    angle: ANGLES[0],
    weekday: 2,
    words: 5,
    minConnection: 0.8,
    maxConnection: 0.97,
    mood: 'straightforward',
};

const emptyHistory: ChainHistory = { recentThemes: [], recentWords: [] };

const BASE_HINTS = [
    'A crustacean that cements itself to hard surfaces',
    'A solid mineral mass at the edge of the sea',
    'Where land meets water',
    'White bubbles churned up by waves',
    'What the sea leaves behind when it dries',
];

function chain(overrides: Partial<GeneratedChain> = {}): GeneratedChain {
    return {
        theme: 'Tidal Pools',
        words: ['Barnacle', 'Rock', 'Shore', 'Foam', 'Salt'],
        hints: [...BASE_HINTS],
        connection_scores: [0.9, 0.88, 0.92, 0.85, 0.9],
        ...overrides,
    };
}

function reasonsFor(overrides: Partial<GeneratedChain>, history = emptyHistory): string[] {
    const result = validateChain(chain(overrides), plan, history);
    return result.ok ? [] : result.reasons;
}

describe('validateChain', () => {
    it('accepts a well-formed chain', () => {
        expect(validateChain(chain(), plan, emptyHistory)).toEqual({ ok: true });
    });

    it('rejects a chain that repeats one of its own words', () => {
        const reasons = reasonsFor({ words: ['Salt', 'Rock', 'Shore', 'Foam', 'Salt'] });
        expect(reasons.join(' ')).toMatch(/appears twice/i);
    });

    it('treats casing and spacing as the same word when spotting repeats', () => {
        const reasons = reasonsFor({ words: ['Salt', 'Rock', 'Shore', 'Foam', ' salt '] });
        expect(reasons.join(' ')).toMatch(/appears twice/i);
    });

    it('rejects a chain that misses the weekday length by more than one', () => {
        const reasons = reasonsFor({
            words: ['Kelp', 'Tide', 'Crab'],
            hints: ['x', 'y', 'z'],
            connection_scores: [0.9, 0.9, 0.9],
        });
        expect(reasons.join(' ')).toMatch(/must be 5 words long/i);
    });

    it('tolerates being one word off the target', () => {
        const result = validateChain(
            chain({
                words: ['Barnacle', 'Rock', 'Shore', 'Foam'],
                hints: BASE_HINTS.slice(0, 4),
                connection_scores: [0.9, 0.88, 0.92, 0.85],
            }),
            plan,
            emptyHistory,
        );
        expect(result.ok).toBe(true);
    });

    it('rejects words recycled from a recent puzzle', () => {
        const reasons = reasonsFor({}, { recentThemes: [], recentWords: ['foam', 'Kettle'] });
        expect(reasons.join(' ')).toMatch(/used in a recent puzzle/i);
        expect(reasons.join(' ')).toMatch(/Foam/);
    });

    it('rejects a theme that echoes a recent one', () => {
        const reasons = reasonsFor(
            { theme: 'A Symphony of Sound' },
            { recentThemes: ['Symphony of Sounds'], recentWords: [] },
        );
        expect(reasons.join(' ')).toMatch(/too close to the recent theme/i);
    });

    it('rejects a hint that points at the list instead of describing', () => {
        const hints = [...BASE_HINTS];
        hints[1] = 'It comes right before the next word in the chain';
        expect(reasonsFor({ hints }).join(' ')).toMatch(/refers to the list itself/i);
    });

    it('rejects a hint that contains its own answer', () => {
        const hints = [...BASE_HINTS];
        hints[2] = 'The shore is where land meets water';
        expect(reasonsFor({ hints }).join(' ')).toMatch(/contains the answer/i);
    });

    it('does not flag a hint that merely contains the answer inside a longer word', () => {
        const words = ['Bag', 'Rock', 'Shore', 'Foam', 'Salt'];
        const hints = [
            'Checked baggage on a long flight',
            'A solid mineral mass',
            'Where land meets water',
            'Churned white bubbles',
            'What the sea leaves behind',
        ];
        expect(reasonsFor({ words, hints })).toEqual([]);
    });

    it('rejects a mismatched number of hints', () => {
        expect(reasonsFor({ hints: ['only one'] }).join(' ')).toMatch(/one hint per word/i);
    });

    it('rejects links that are too loose for the day', () => {
        const reasons = reasonsFor({ connection_scores: [0.5, 0.5, 0.5, 0.5, 0.5] });
        expect(reasons.join(' ')).toMatch(/too loose/i);
    });

    it('rejects links that are too obvious for a hard day', () => {
        const hardPlan: DayPlan = { ...plan, minConnection: 0.6, maxConnection: 0.75 };
        const result = validateChain(chain({ connection_scores: [1, 1, 1, 1, 1] }), hardPlan, emptyHistory);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reasons.join(' ')).toMatch(/too obvious/i);
    });

    it('rejects out-of-range connection scores', () => {
        expect(reasonsFor({ connection_scores: [0.9, 0.9, 0.9, 0.9, 5] }).join(' '))
            .toMatch(/between 0.1 and 1.0/i);
    });

    it('rejects a phrase where a word belongs', () => {
        const words = ['A cold morning by the sea', 'Rock', 'Shore', 'Foam', 'Salt'];
        expect(reasonsFor({ words }).join(' ')).toMatch(/is a phrase/i);
    });

    it('allows a two-word entry', () => {
        const words = ['Sleeping bag', 'Rock', 'Shore', 'Foam', 'Salt'];
        expect(reasonsFor({ words })).toEqual([]);
    });

    it('rejects a missing theme', () => {
        expect(reasonsFor({ theme: '   ' }).join(' ')).toMatch(/theme is missing/i);
    });

    it('collects every problem in one pass rather than stopping at the first', () => {
        const reasons = reasonsFor(
            { theme: 'Tidal Pool', words: ['Salt', 'Rock', 'Salt', 'Foam', 'Barnacle'] },
            { recentThemes: ['Tidal Pools'], recentWords: ['Rock'] },
        );

        expect(reasons.length).toBeGreaterThanOrEqual(3);
    });

    it('survives a chain with no hints or scores at all', () => {
        const result = validateChain(
            { theme: 'Tidal Pools', words: ['Barnacle', 'Rock', 'Shore', 'Foam', 'Salt'] },
            plan,
            emptyHistory,
        );
        expect(result.ok).toBe(true);
    });
});

describe('themesAreTooSimilar', () => {
    it('spots the same theme in different clothes', () => {
        expect(themesAreTooSimilar('Symphony of Sound', 'A Symphony of Sounds')).toBe(true);
        expect(themesAreTooSimilar('Deep Sea Discovery', 'Discovery of the Deep')).toBe(true);
    });

    it('leaves genuinely different themes alone', () => {
        expect(themesAreTooSimilar('Backyard Campout', 'Symphony of Sound')).toBe(false);
        expect(themesAreTooSimilar('Golden Apiary', 'Winter Sports')).toBe(false);
    });

    it('does not trip over short filler words', () => {
        expect(themesAreTooSimilar('The Art of the Deal', 'The Sound of the Sea')).toBe(false);
    });
});
