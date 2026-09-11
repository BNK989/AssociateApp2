import { useTranslations } from 'next-intl';
import type { ShareSquare } from '@/lib/daily/dailyShare';

/**
 * The day's chain, spelled out, to everyone who finished it.
 *
 * The game's real payoff is the chain — seeing how six words hang together is
 * the thing worth coming back for, and it is the one part of a daily puzzle
 * that reads as content rather than as a score. A player who cleared the board
 * assembled it themselves on the way up. A player who did not never saw it at
 * all: the words they missed scrolled past one at a time, unconnected, and the
 * end screen gave them a grade and a "come back tomorrow".
 *
 * That is the wrong thing to withhold. Skill should decide the *grade*, never
 * whether the player gets the story — withholding it from the player who
 * struggled takes the payoff away from exactly the person who needs a reason
 * to return. So the chain is shown in full, in order, whatever the tier.
 *
 * Colour carries how each word went, matching the grid above it, so the two
 * read as one account of the day rather than two.
 */

/**
 * The word the game opened with, which the player never guessed.
 *
 * It needs its own treatment: it has no square, and falling through to the
 * `missed` grey would mark the one word nobody could have got wrong as a
 * failure.
 */
const START_WORD_STYLE = 'bg-background text-foreground border-dashed border-border';

const WORD_STYLES: Record<ShareSquare, string> = {
    clean: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    hard_won: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
    hinted: 'bg-amber-400/10 text-amber-700 dark:text-amber-300 border-amber-400/30',
    missed: 'bg-muted text-muted-foreground border-border',
};

type ChainRevealProps = {
    /** The day's words, in chain order. */
    words: string[];
    /** One square per guessable word — the free starting word has none. */
    squares: ShareSquare[];
    /** The day's theme, when there is one. */
    theme?: string;
};

export function ChainReveal({ words, squares, theme }: ChainRevealProps) {
    const t = useTranslations('GameRoom.DailyEndGame');

    if (words.length === 0) return null;

    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-4">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t('chain_label')}
            </span>

            {theme && (
                <span className="text-sm font-semibold text-foreground">{theme}</span>
            )}

            <ol className="flex flex-wrap items-center justify-center gap-1.5">
                {words.map((word, index) => {
                    const square = squares[index];

                    return (
                        <li
                            key={`${word}-${index}`}
                            className={`rounded-lg border px-2 py-1 text-sm font-medium ${
                                square ? WORD_STYLES[square] : START_WORD_STYLE
                            }`}
                        >
                            {word}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
