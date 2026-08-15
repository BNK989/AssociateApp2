import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFallbackDailyGame, fetchAIGeneratedDailyGame, FALLBACK_DAILY_GAMES } from './dailyGameGenerator';

describe('dailyGameGenerator', () => {
    describe('getFallbackDailyGame', () => {
        it('should return a valid fallback daily game object for any given date', () => {
            const fallback = getFallbackDailyGame('2026-08-15');
            expect(fallback).toHaveProperty('theme');
            expect(fallback).toHaveProperty('words');
            expect(fallback).toHaveProperty('hints');
            expect(fallback).toHaveProperty('connection_scores');
            expect(fallback.words.length).toBeGreaterThanOrEqual(4);
            expect(fallback.hints.length).toBe(fallback.words.length);
            expect(fallback.connection_scores.length).toBe(fallback.words.length);
        });

        it('should be deterministic for the same date string', () => {
            const fallback1 = getFallbackDailyGame('2026-08-15');
            const fallback2 = getFallbackDailyGame('2026-08-15');
            expect(fallback1).toEqual(fallback2);
        });

        it('should cycle through fallback pool for different dates', () => {
            const fallbacks = new Set();
            for (let i = 1; i <= 10; i++) {
                const dateStr = `2026-08-${i.toString().padStart(2, '0')}`;
                fallbacks.add(getFallbackDailyGame(dateStr).theme);
            }
            expect(fallbacks.size).toBeGreaterThan(1);
        });
    });

    describe('fetchAIGeneratedDailyGame', () => {
        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('should return null when GEMINI_KEY is missing', async () => {
            const originalKey = process.env.GEMINI_KEY;
            delete process.env.GEMINI_KEY;
            const result = await fetchAIGeneratedDailyGame('2026-08-15');
            expect(result).toBeNull();
            process.env.GEMINI_KEY = originalKey;
        });

        it('should successfully parse valid JSON response from Gemini API', async () => {
            const mockResponse = {
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: JSON.stringify({
                                        theme: "Cosmic Voyage",
                                        words: ["Star", "Galaxy", "Nebula", "Space", "Astronaut"],
                                        hints: [
                                            "Luminous sphere of plasma",
                                            "System of stars bound by gravity",
                                            "Interstellar cloud of dust and gas",
                                            "The boundless expanse beyond Earth",
                                            "Space traveler navigating the cosmos"
                                        ],
                                        connection_scores: [0.95, 0.9, 0.85, 0.9, 1.0]
                                    })
                                }
                            ]
                        }
                    }
                ]
            };

            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            } as Response);

            const result = await fetchAIGeneratedDailyGame('2026-08-15');
            expect(result).not.toBeNull();
            expect(result?.theme).toBe("Cosmic Voyage");
            expect(result?.words).toEqual(["Star", "Galaxy", "Nebula", "Space", "Astronaut"]);
            expect(result?.hints.length).toBe(5);
            expect(result?.connection_scores.length).toBe(5);
        });

        it('should handle markdown fenced JSON codeblocks from Gemini', async () => {
            const mockMarkdownText = `\`\`\`json
{
  "theme": "Baking Delights",
  "words": ["Flour", "Dough", "Bread", "Toast", "Butter"],
  "hints": ["Ground grain", "Mixture", "Baked loaf", "Crisped slice", "Dairy spread"],
  "connection_scores": [0.9, 0.95, 0.9, 0.85, 1.0]
}
\`\`\``;

            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: mockMarkdownText }] } }]
                })
            } as Response);

            const result = await fetchAIGeneratedDailyGame('2026-08-15');
            expect(result).not.toBeNull();
            expect(result?.theme).toBe("Baking Delights");
            expect(result?.words.length).toBe(5);
        });

        it('should try backup models if primary model fails with HTTP error', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        candidates: [{
                            content: {
                                parts: [{
                                    text: JSON.stringify({
                                        theme: "Backup Theme",
                                        words: ["A", "B", "C", "D"],
                                        hints: ["H1", "H2", "H3", "H4"],
                                        connection_scores: [0.8, 0.8, 0.8, 1.0]
                                    })
                                }]
                            }
                        }]
                    })
                } as Response);

            const result = await fetchAIGeneratedDailyGame('2026-08-15');
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(result?.theme).toBe("Backup Theme");
        });
    });
});
