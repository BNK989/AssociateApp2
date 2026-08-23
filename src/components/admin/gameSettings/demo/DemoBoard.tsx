'use client';

import { Flag, Lightbulb, Timer, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_HINT_LEVEL } from '@/lib/daily/dailyScoring';
import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { DemoWordRow } from './DemoWordRow';
import { useDemoGame } from './useDemoGame';

/**
 * The demo chain, played against the policy currently in the editor.
 *
 * Mounted under a key derived from that policy, so every edit starts a clean
 * run rather than leaving a half-played board straddling two configurations.
 */
export function DemoBoard({ policy }: { policy: DailyHintPolicy }) {
    const demo = useDemoGame(policy);
    const target = demo.targetMessage;
    const atTopOfLadder = (target?.hint_level || 0) >= MAX_HINT_LEVEL;

    return (
        <div className="space-y-4">
            <ol className="space-y-2">
                {demo.messages.map((message) => (
                    <DemoWordRow
                        key={message.id}
                        message={message}
                        isTarget={message.id === target?.id}
                        isWrong={message.id === demo.wrongId && !message.is_solved}
                    />
                ))}
            </ol>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={demo.guess}
                    onChange={(e) => demo.setGuess(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') demo.submit();
                    }}
                    placeholder={demo.gameOver ? 'Chain finished' : 'Guess the word'}
                    disabled={demo.gameOver}
                    className="w-48"
                    aria-label="Demo guess"
                />

                <Button onClick={demo.submit} disabled={demo.gameOver || demo.guess.trim() === ''}>
                    Guess
                </Button>

                <Button
                    variant="outline"
                    onClick={() => target && demo.setGuess(target.content)}
                    disabled={demo.gameOver || !target}
                    title="You are testing the hints, not the puzzle"
                >
                    <Wand2 className="me-2 h-4 w-4" />
                    Fill the answer
                </Button>

                <Button
                    variant="outline"
                    onClick={demo.revealHint}
                    disabled={demo.gameOver || !target || atTopOfLadder}
                >
                    <Lightbulb className="me-2 h-4 w-4" />
                    Hint
                </Button>

                <Button variant="ghost" onClick={demo.giveUp} disabled={demo.gameOver || !target}>
                    <Flag className="me-2 h-4 w-4" />
                    Give up
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                    Score <span className="font-semibold text-foreground">{demo.score}</span>
                </span>

                <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    {demo.gameOver
                        ? 'chain finished'
                        : demo.countdown.isActive
                            ? `next hint in ${demo.countdown.secondsLeft}s`
                            : atTopOfLadder
                                ? 'no hints left on this word'
                                : 'no automatic hint coming'}
                </span>
            </div>
        </div>
    );
}
