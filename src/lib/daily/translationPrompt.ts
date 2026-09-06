/**
 * The instruction handed to Gemini when a day's puzzle is translated.
 *
 * Two things here are deliberate.
 *
 * The target language is **named**, not passed as an ISO code. The prompt used
 * to say `Target Locale: "he"` and nothing else; asked for a two-letter code,
 * `gemini-flash-lite` will happily answer in a neighbouring right-to-left
 * language, which is how Arabic words ended up inside Hebrew hints.
 *
 * And the script is stated as a **hard constraint**, with the confusable script
 * named. "Write in Hebrew" is advice the model can drift away from mid-string;
 * "every letter must be in the Hebrew script, never Arabic" is a rule that the
 * check in `translationScript.ts` then enforces on the way back.
 */

import {
    languageFor,
    scriptFor,
    LOCALE_CONFUSABLE_SCRIPT,
} from './translationScript';
import { isSupportedLocale } from '@/i18n/locales';

export type TranslationPromptArgs = {
    words: string[];
    theme: string;
    locale: string;
    /** Why the previous attempt was rejected, fed back so the retry can correct. */
    rejectionReasons?: string[];
};

function scriptRules(locale: string): string[] {
    const language = languageFor(locale);
    const script = scriptFor(locale);
    const confusable = isSupportedLocale(locale) ? LOCALE_CONFUSABLE_SCRIPT[locale] : undefined;

    const rules = [
        `Write every character of your answer in ${language}, using the ${script} script.`,
        `A single word in another language or another script makes the whole puzzle unusable, so do not mix scripts inside a word, a hint, or the theme.`,
    ];

    if (confusable) {
        rules.push(
            `${language} is frequently confused with ${confusable}. Do not use ${confusable} characters anywhere in your answer.`,
        );
    }

    rules.push('Latin letters are allowed only inside a proper noun that has no accepted local form.');

    return rules;
}

export function buildTranslationPrompt({ words, theme, locale, rejectionReasons }: TranslationPromptArgs): string {
    const language = languageFor(locale);

    const sections = [
        'You are a professional game translator and localiser.',
        `Translate a "Word Association Chain" puzzle from English into ${language} (locale code "${locale}").`,
        '',
        `Original theme: "${theme}"`,
        `Original words: ${JSON.stringify(words)}`,
        '',
        'LANGUAGE',
        ...scriptRules(locale),
        '',
        'CONTENT',
        `1. Translate the theme into ${language}.`,
        `2. Translate the ${words.length} words into ${language}, keeping the chain intact:`,
        '   - word 1 must associate with word 2, word 2 with word 3, and so on.',
        '   - if a literal translation breaks an association, choose a culturally appropriate',
        '     word that keeps the link — the chain matters more than the literal word.',
        `3. Write ${words.length} NEW hints, one per translated word, in the same order.`,
        '   - a hint must never contain its own word or a root variation of it.',
        '   - hints are cryptic but solvable, in the register of a crossword clue.',
        '',
        'OUTPUT',
        'Return ONLY a raw JSON object, no prose and no code fence, in exactly this shape:',
        '{',
        '  "theme": "<translated theme>",',
        `  "words": [<${words.length} translated words, same order as the original>],`,
        `  "hints": [<${words.length} hints, same order>]`,
        '}',
    ];

    if (rejectionReasons && rejectionReasons.length > 0) {
        sections.push(
            '',
            'Your previous attempt was rejected for these reasons. Fix all of them:',
            ...rejectionReasons.map((reason) => `- ${reason}`),
        );
    }

    return sections.join('\n');
}
