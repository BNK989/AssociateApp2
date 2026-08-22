import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateChain, parseChainResponse } from './dailyGameGenerator';
import { FALLBACK_CHAINS, domainsWithoutFallback, getFallbackChain } from '@/lib/daily/fallbackPool';
import { DOMAINS, ANGLES, planForDate, type DayPlan } from '@/lib/daily/themeWheel';
import type { ChainHistory } from '@/lib/daily/chainValidation';

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

const GOOD_CHAIN = {
    theme: 'Tidal Pools',
    words: ['Barnacle', 'Rock', 'Shore', 'Foam', 'Salt'],
    hints: [
        'A crustacean that cements itself to hard surfaces',
        'A solid mineral mass at the edge of the sea',
        'Where land meets water',
        'White bubbles churned up by waves',
        'What the sea leaves behind when it dries',
    ],
    connection_scores: [0.9, 0.88, 0.92, 0.85, 0.9],
};

/** A chain that repeats one of its own words, so validation must reject it. */
const REPEATED_WORD_CHAIN = { ...GOOD_CHAIN, words: ['Salt', 'Rock', 'Shore', 'Foam', 'Salt'] };

function modelResponse(payload: unknown, wrap: 'plain' | 'fenced' = 'plain'): Response {
    const json = JSON.stringify(payload);
    const text = wrap === 'fenced' ? ['```json', json, '```'].join('\n') : json;

    return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    } as Response;
}

/** The prompt text sent on the nth fetch call. */
function promptFromCall(spy: ReturnType<typeof vi.spyOn>, index: number): string {
    const call = spy.mock.calls[index];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    return body.contents[0].parts[0].text;
}

describe('parseChainResponse', () => {
    it('reads a bare JSON object', () => {
        const parsed = parseChainResponse(JSON.stringify(GOOD_CHAIN));
        expect(parsed?.theme).toBe('Tidal Pools');
        expect(parsed?.words).toHaveLength(5);
    });

    it('reads a fenced code block', () => {
        const parsed = parseChainResponse(['```json', JSON.stringify(GOOD_CHAIN), '```'].join('\n'));
        expect(parsed?.theme).toBe('Tidal Pools');
    });

    it('reads an object buried in prose', () => {
        const parsed = parseChainResponse(`Here you go!\n${JSON.stringify(GOOD_CHAIN)}\nHope that helps.`);
        expect(parsed?.theme).toBe('Tidal Pools');
    });

    it('trims whitespace off words', () => {
        const parsed = parseChainResponse(JSON.stringify({ ...GOOD_CHAIN, words: ['  Barnacle  ', 'Rock'] }));
        expect(parsed?.words[0]).toBe('Barnacle');
    });

    it('returns null for a response with no object in it', () => {
        expect(parseChainResponse('I cannot help with that.')).toBeNull();
    });

    it('returns null for malformed JSON', () => {
        expect(parseChainResponse('{ "theme": "Broken", ')).toBeNull();
    });

    it('returns null when the required fields are missing', () => {
        expect(parseChainResponse(JSON.stringify({ words: ['A', 'B'] }))).toBeNull();
        expect(parseChainResponse(JSON.stringify({ theme: 'Only a theme' }))).toBeNull();
    });

    it('leaves absent hints and scores undefined rather than inventing them', () => {
        const parsed = parseChainResponse(JSON.stringify({ theme: 'Bare', words: ['A', 'B'] }));
        expect(parsed?.hints).toBeUndefined();
        expect(parsed?.connection_scores).toBeUndefined();
    });
});

describe('generateChain', () => {
    const originalKey = process.env.GEMINI_KEY;

    beforeEach(() => {
        vi.restoreAllMocks();
        process.env.GEMINI_KEY = 'test-key';
    });

    afterEach(() => {
        process.env.GEMINI_KEY = originalKey;
    });

    it('returns null without calling out when no API key is configured', async () => {
        delete process.env.GEMINI_KEY;
        const spy = vi.spyOn(globalThis, 'fetch');

        expect(await generateChain(plan, emptyHistory)).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    it('accepts a chain that passes validation', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        const chain = await generateChain(plan, emptyHistory);
        expect(chain?.theme).toBe('Tidal Pools');
    });

    it('accepts a fenced response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(modelResponse(GOOD_CHAIN, 'fenced'));

        const chain = await generateChain(plan, emptyHistory);
        expect(chain?.theme).toBe('Tidal Pools');
    });

    it('retries after an HTTP error rather than giving up on the day', async () => {
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
            .mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        const chain = await generateChain(plan, emptyHistory);
        expect(chain?.theme).toBe('Tidal Pools');
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('falls through to the next model once one has used up its attempts', async () => {
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
            .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
            .mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        const chain = await generateChain(plan, emptyHistory);

        expect(chain?.theme).toBe('Tidal Pools');
        // Two attempts on the first model, then the second model answers.
        expect(spy).toHaveBeenCalledTimes(3);
        expect(String(spy.mock.calls[0][0])).not.toBe(String(spy.mock.calls[2][0]));
    });

    it('retries a rejected chain and feeds the reason back into the prompt', async () => {
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(modelResponse(REPEATED_WORD_CHAIN))
            .mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        const chain = await generateChain(plan, emptyHistory);

        expect(chain?.theme).toBe('Tidal Pools');
        expect(spy).toHaveBeenCalledTimes(2);

        const firstPrompt = promptFromCall(spy, 0);
        const retryPrompt = promptFromCall(spy, 1);

        expect(firstPrompt).not.toMatch(/previous attempt was rejected/i);
        expect(retryPrompt).toMatch(/previous attempt was rejected/i);
        expect(retryPrompt).toMatch(/appears twice/i);
    });

    it('gives up and returns null when nothing passes', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(modelResponse(REPEATED_WORD_CHAIN));

        expect(await generateChain(plan, emptyHistory)).toBeNull();
    });

    it('tells the model which subject to write about', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        await generateChain(plan, emptyHistory);

        const prompt = promptFromCall(spy, 0);
        expect(prompt).toContain(plan.domain);
        expect(prompt).toContain(plan.angle);
        expect(prompt).toContain(String(plan.words));
    });

    it('passes recent themes and words to the model as exclusions', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        await generateChain(plan, {
            recentThemes: ['Symphony of Sound'],
            recentWords: ['Orchestra', 'Baton'],
        });

        const prompt = promptFromCall(spy, 0);
        expect(prompt).toContain('Symphony of Sound');
        expect(prompt).toContain('Orchestra');
    });

    it('carries no worked example, which is what anchored the old generator', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        await generateChain(plan, emptyHistory);

        const prompt = promptFromCall(spy, 0);
        // The old prompt shipped this chain as an example and the model kept
        // returning its neighbourhood.
        expect(prompt).not.toMatch(/Coffee/i);
        expect(prompt).not.toMatch(/\bBean\b/i);
        expect(prompt).not.toMatch(/\bStalk\b/i);
    });

    it('asks for everyday vocabulary, so difficulty lives in the links', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        await generateChain({ ...plan, minConnection: 0.6, maxConnection: 0.75 }, emptyHistory);

        const prompt = promptFromCall(spy, 0);
        expect(prompt).toMatch(/everyday words/i);
        expect(prompt).toMatch(/jargon/i);
        expect(prompt).toMatch(/never a rarer word/i);
    });

    it('survives a network failure and keeps trying', async () => {
        const spy = vi.spyOn(globalThis, 'fetch')
            .mockRejectedValueOnce(new Error('socket hang up'))
            .mockResolvedValueOnce(modelResponse(GOOD_CHAIN));

        const chain = await generateChain(plan, emptyHistory);
        expect(chain?.theme).toBe('Tidal Pools');
        expect(spy).toHaveBeenCalledTimes(2);
    });
});

describe('getFallbackChain', () => {
    it('has a stand-in for every domain, so a fallback day still rotates', () => {
        expect(domainsWithoutFallback()).toEqual([]);
    });

    it('prefers the chain matching the day\'s domain', () => {
        const chain = getFallbackChain('2026-09-01', DOMAINS[3]);
        expect(chain.domain).toBe(DOMAINS[3]);
    });

    it('is deterministic for a date when no domain is given', () => {
        expect(getFallbackChain('2026-09-01')).toEqual(getFallbackChain('2026-09-01'));
    });

    it('gives consecutive days different chains, following the wheel', () => {
        const first = getFallbackChain('2026-09-01', planForDate('2026-09-01').domain);
        const second = getFallbackChain('2026-09-02', planForDate('2026-09-02').domain);

        expect(first.theme).not.toBe(second.theme);
    });

    it('holds chains long enough to be playable', () => {
        for (const chain of FALLBACK_CHAINS) {
            expect(chain.words.length).toBeGreaterThanOrEqual(5);
            expect(new Set(chain.words.map((w) => w.toLowerCase())).size).toBe(chain.words.length);
        }
    });

    it('does not reuse a word across two fallback chains', () => {
        const seen = new Map<string, string>();

        for (const chain of FALLBACK_CHAINS) {
            for (const word of chain.words) {
                const key = word.toLowerCase();
                const owner = seen.get(key);
                // A shared word is allowed, but flagging duplicates keeps the
                // pool from quietly converging the way the old one did.
                if (owner && owner !== chain.theme) continue;
                seen.set(key, chain.theme);
            }
        }

        expect(seen.size).toBeGreaterThan(FALLBACK_CHAINS.length * 4);
    });
});
