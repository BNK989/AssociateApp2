'use client';

import { Check, Lightbulb, Play, X } from 'lucide-react';
import type { Message } from '@/hooks/useGameLogic';
import { CipherText } from '@/components/CipherText';
import { MAX_STRIKES } from '@/lib/daily/dailyScoring';

const LEVEL_LABELS: Record<number, string> = {
    1: 'First letter',
    2: 'Scramble',
    3: 'AI clue',
};

type DemoWordRowProps = {
    message: Message;
    /** True for the word the demo player is currently on. */
    isTarget: boolean;
    /** True while the last guess on this word was wrong. */
    isWrong: boolean;
};

/**
 * One word of the demo chain.
 *
 * Uses the same `CipherText` the game does, which is the point of the demo:
 * "scramble on every word" is a sentence, and this is what it actually looks
 * like on a board the game master has not reached the bottom of yet.
 */
export function DemoWordRow({ message, isTarget, isWrong }: DemoWordRowProps) {
    const level = message.hint_level || 0;
    const strikes = message.strikes || 0;
    const struckOut = strikes >= MAX_STRIKES && !message.solved_by;

    return (
        <li
            className={`rounded-lg border p-3 transition-colors ${isTarget
                ? 'border-primary/60 bg-primary/5'
                : 'border-border bg-background'
                } ${isWrong ? 'animate-shake' : ''}`}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {message.is_solved && !struckOut ? (
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : struckOut ? (
                        <X className="h-4 w-4 text-destructive" />
                    ) : isTarget ? (
                        <Play className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                </span>

                <CipherText
                    text={message.content}
                    cipherText={message.cipher_text}
                    visible={message.is_solved}
                    hintLevel={level}
                    guesses={message.guesses}
                    className="text-lg font-semibold tracking-wide"
                />

                <span className="ms-auto flex items-center gap-2">
                    {level > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            <Lightbulb className="h-3 w-3" />
                            {LEVEL_LABELS[level] ?? `Level ${level}`}
                        </span>
                    )}

                    {strikes > 0 && (
                        <span className="text-xs text-destructive">
                            {strikes}/{MAX_STRIKES} strikes
                        </span>
                    )}
                </span>
            </div>

            {level === 3 && message.ai_hint && (
                <p className="mt-2 border-s-2 border-border ps-3 text-sm text-muted-foreground">
                    {message.ai_hint}
                </p>
            )}
        </li>
    );
}
