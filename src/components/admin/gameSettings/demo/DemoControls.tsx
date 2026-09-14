'use client';

import { FastForward, Flag, Lightbulb, Timer, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The harness around the demo board: the levers a game master needs and a
 * player must never have.
 *
 * Kept apart from the board on purpose. Everything below the controls is the
 * game exactly as it ships — the same composer, the same ladder, the same
 * drip — and everything here is scaffolding: filling the answer in, forcing the
 * next rung, and pushing the clock forward so the offer being configured can be
 * seen now rather than in twenty seconds of silence.
 */

/** What one press of the skip control is worth. */
export const SKIP_STEP_MS = 10_000;

type DemoControlsProps = {
    score: number;
    gameOver: boolean;
    hasTarget: boolean;
    /** True once the word has no rung left to hand over. */
    atTopOfLadder: boolean;
    countdown: { isActive: boolean; secondsLeft: number };
    /** Dwell already credited on this word by the skip control, in ms. */
    creditMs: number;
    onFillAnswer: () => void;
    onHint: () => void;
    onGiveUp: () => void;
    onSkipAhead: () => void;
};

export function DemoControls({
    score, gameOver, hasTarget, atTopOfLadder, countdown, creditMs,
    onFillAnswer, onHint, onGiveUp, onSkipAhead,
}: DemoControlsProps) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onFillAnswer}
                    disabled={gameOver || !hasTarget}
                    title="You are testing the hints, not the puzzle"
                >
                    <Wand2 className="me-2 h-4 w-4" aria-hidden="true" />
                    Fill the answer
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onHint}
                    disabled={gameOver || !hasTarget || atTopOfLadder}
                >
                    <Lightbulb className="me-2 h-4 w-4" aria-hidden="true" />
                    Hint
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onSkipAhead}
                    disabled={gameOver || !hasTarget}
                    title="Credits the stuck ladder with dwell, the way a wrong guess does"
                >
                    <FastForward className="me-2 h-4 w-4" aria-hidden="true" />
                    Skip {SKIP_STEP_MS / 1000}s ahead
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onGiveUp}
                    disabled={gameOver || !hasTarget}
                >
                    <Flag className="me-2 h-4 w-4" aria-hidden="true" />
                    Give up
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                    Score <span className="font-semibold text-foreground">{score}</span>
                </span>

                <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                    {gameOver
                        ? 'chain finished'
                        : countdown.isActive
                            ? `next hint in ${countdown.secondsLeft}s`
                            : atTopOfLadder
                                ? 'no hints left on this word'
                                : 'no automatic hint coming'}
                </span>

                {creditMs > 0 && (
                    <span className="text-muted-foreground">
                        {creditMs / 1000}s of dwell credited on this word
                    </span>
                )}
            </div>
        </div>
    );
}
