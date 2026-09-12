import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import en from '../../../messages/en.json';

/**
 * Translated for real, against the shipped English copy.
 *
 * The share text is the product here -- a missing key or a fumbled separator is
 * the whole defect -- so the assertions below are on the exact string a player
 * pastes into a chat, not on key names. Interpolation is the plain `{name}`
 * substitution these particular strings use; none of them need ICU plurals.
 */
vi.mock('next-intl', () => ({
    useTranslations: (namespace: string) => (key: string, values: Record<string, unknown> = {}) => {
        const messages = en[namespace as keyof typeof en] as Record<string, string>;
        const template = messages[key];
        if (template === undefined) throw new Error(`Missing translation: ${namespace}.${key}`);
        return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
    },
}));

vi.mock('@/lib/utils', () => ({
    getURL: (path: string) => `https://associ8game.com${path}`,
}));

import { useDailyShareText } from './useDailyShareText';
import type { Message } from '@/hooks/useGameLogic';
import { MAX_STRIKES } from '@/lib/daily/dailyScoring';

function word(overrides: Partial<Message> = {}): Message {
    return {
        id: Math.random().toString(),
        content: 'anchor',
        cipher_length: 6,
        is_solved: true,
        user_id: 'p1',
        created_at: '2026-09-12T00:00:00Z',
        strikes: 0,
        hint_level: 0,
        winner_points: 10,
        ...overrides,
    };
}

/** The last word is free, so it never earns a square. */
const startWord = word({ winner_points: 0 });

function shareText(args: Partial<Parameters<typeof useDailyShareText>[0]> = {}) {
    const { result } = renderHook(() => useDailyShareText({
        date: '2026-09-12',
        score: 92,
        messages: [word(), word(), word({ strikes: MAX_STRIKES, winner_points: 0 }), startWord],
        streak: null,
        ...args,
    }));
    return result.current;
}

describe('useDailyShareText', () => {
    it('leads with the theme, then the grid, the numbers and the challenge', () => {
        expect(shareText({ theme: 'Buried Treasure' })).toBe(
            'Associ8 #259 — Buried Treasure\n'
            + '\u{1F7E9}\u{1F7E9}\u2B1C\n'
            + '2/3 · 92 pts\n'
            + '92 to beat. Your turn.\n'
            + '\nhttps://associ8game.com/daily',
        );
    });

    it('falls back to the bare puzzle number when the day has no theme', () => {
        expect(shareText().split('\n')[0]).toBe('Associ8 #259');
        expect(shareText({ theme: '   ' }).split('\n')[0]).toBe('Associ8 #259');
    });

    it('folds a streak into the result line once it is worth announcing', () => {
        expect(shareText({ streak: 1 }).split('\n')[2]).toBe('2/3 · 92 pts');
        expect(shareText({ streak: 4 }).split('\n')[2]).toBe('2/3 · 92 pts · 🔥 4 day streak');
    });

    it('challenges on a cleared chain and concedes on a blank one', () => {
        const perfect = shareText({ messages: [word(), word(), startWord] });
        expect(perfect).toContain('Whole chain, no gaps. Beat 92?');

        const blank = shareText({
            score: 0,
            messages: [word({ strikes: MAX_STRIKES, winner_points: 0 }), startWord],
        });
        expect(blank).toContain('The chain won today. Think you can crack it?');
        // Nothing to beat, so the closing line does not ask for a number.
        expect(blank).not.toContain('Beat 0');
    });

    it('never carries a word off the board', () => {
        const text = shareText({
            theme: 'Buried Treasure',
            messages: [word({ content: 'doubloon' }), word({ content: 'galleon' }), startWord],
        });

        for (const answer of ['doubloon', 'galleon']) {
            expect(text.toLowerCase()).not.toContain(answer);
        }
    });
});
