import { describe, expect, it } from 'vitest';
import { buildTranslationPrompt } from './translationPrompt';

const args = { words: ['Whisper', 'Rustle', 'Silence'], theme: 'Sounds of the night' };

describe('buildTranslationPrompt', () => {
    it('names the language rather than only passing the ISO code', () => {
        const prompt = buildTranslationPrompt({ ...args, locale: 'he' });
        expect(prompt).toContain('Hebrew');
        expect(prompt).toContain('Hebrew script');
    });

    // The bug this whole path exists for: the model answered a Hebrew request
    // with Arabic words, so the confusable language is ruled out by name.
    it('rules out the confusable script by name for Hebrew and Arabic', () => {
        expect(buildTranslationPrompt({ ...args, locale: 'he' })).toContain('Do not use Arabic characters');
        expect(buildTranslationPrompt({ ...args, locale: 'ar' })).toContain('Do not use Hebrew characters');
    });

    it('adds no confusable clause for a locale that has none', () => {
        const prompt = buildTranslationPrompt({ ...args, locale: 'fr' });
        expect(prompt).toContain('French');
        expect(prompt).not.toContain('frequently confused');
    });

    it('carries the chain length into the words and hints instructions', () => {
        const prompt = buildTranslationPrompt({ ...args, locale: 'de' });
        expect(prompt).toContain('Translate the 3 words');
        expect(prompt).toContain('Write 3 NEW hints');
    });

    it('feeds rejection reasons back so the retry can correct them', () => {
        const prompt = buildTranslationPrompt({
            ...args,
            locale: 'he',
            rejectionReasons: ['hints[1] mixes Arabic ("بالكاد") into Hebrew text'],
        });
        expect(prompt).toContain('Your previous attempt was rejected');
        expect(prompt).toContain('بالكاد');
    });

    it('omits the rejection section on a first attempt', () => {
        expect(buildTranslationPrompt({ ...args, locale: 'he' })).not.toContain('previous attempt');
    });
});
