import { useTranslations } from 'next-intl';
import type { ShareSquare } from '@/lib/daily/dailyShare';

/**
 * Tile colours mirror the emoji the share text uses, so what a player sees here
 * is recognisably the thing they are about to paste. Rendered as elements
 * rather than emoji because §3 keeps emoji out of UI chrome -- the exception in
 * `dailyShare` covers the shared artefact itself, not this preview of it.
 */
const SQUARE_STYLES: Record<ShareSquare, string> = {
    clean: 'bg-emerald-500 dark:bg-emerald-500',
    hinted: 'bg-amber-400 dark:bg-amber-400',
    missed: 'bg-muted-foreground/25 dark:bg-muted-foreground/25',
};

type ChainGridProps = {
    squares: ShareSquare[];
};

/**
 * The day's grid, shown before the player shares it.
 *
 * The grid is the game's only organic growth surface, and it was previously
 * invisible until after someone had already decided to press Share. Showing it
 * makes the result feel like an artefact worth passing on, and it stays
 * spoiler-free: shape only, never a word, a hint or the theme.
 */
export function ChainGrid({ squares }: ChainGridProps) {
    const t = useTranslations('GameRoom.DailyEndGame');

    if (squares.length === 0) return null;

    return (
        <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t('grid_label')}
            </span>

            <div
                className="flex flex-wrap justify-center gap-1.5"
                role="img"
                aria-label={t('grid_alt', { total: squares.length })}
            >
                {squares.map((square, index) => (
                    <span
                        key={index}
                        className={`h-5 w-5 rounded-[4px] ${SQUARE_STYLES[square]}`}
                    />
                ))}
            </div>

            <span className="text-xs text-muted-foreground">{t('grid_spoiler_free')}</span>
        </div>
    );
}
