'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { PoolTile } from './PoolTile';
import { MAX_DRIFTING_TILES } from './poolMotion';
import type { PoolLetter } from '@/lib/letterPool/poolRules';

type LetterPoolProps = {
    letters: PoolLetter[];
    /** Pool ids currently sitting in a slot; their sockets show empty. */
    placed: Set<string>;
    dir: 'ltr' | 'rtl';
};

/**
 * The letters the player has found but not placed, held outside the sentence.
 *
 * This is the whole fix in one component. An orange letter drawn inside a line
 * of text is read as being *at* that spot, because a line of text means
 * sequence — and colour, tilt and drift cannot argue a reader out of that. So
 * the letters leave the line. A tile that is not in the word cannot be mistaken
 * for a position in it, which turns a rule the player had to remember into
 * something they can see.
 *
 * Three things keep it affordable on a phone:
 *
 * - It collapses to nothing when the pool is empty, which is most of a word.
 * - It is always exactly one row. Too many letters scroll sideways rather than
 *   wrapping, so the board's height never moves under the player's thumb.
 * - Its sockets never reflow, so placing a letter costs no layout.
 */
export function LetterPool({ letters, placed, dir }: LetterPoolProps) {
    const t = useTranslations('GameRoom.Pool');
    const reduced = Boolean(useReducedMotion());
    const drifting = letters.length <= MAX_DRIFTING_TILES;

    return (
        <AnimatePresence initial={false}>
            {letters.length > 0 && (
                <motion.div
                    key="pool"
                    initial={reduced ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: reduced ? 0 : 0.22, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden"
                >
                    <div
                        dir={dir}
                        className="flex items-center gap-2 pb-2 max-[660px]:pb-1.5"
                    >
                        <span className="flex-none select-none text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {t('label')}
                        </span>

                        <div
                            // One row, always. Overflow scrolls rather than wrapping,
                            // so a long phrase cannot push the board upward.
                            className="pool-track flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            aria-label={t('aria_label', { count: letters.length })}
                        >
                            {letters.map((letter) => (
                                <PoolTile
                                    key={letter.id}
                                    letter={letter}
                                    isHome={!placed.has(letter.id)}
                                    drifting={drifting}
                                    reduced={reduced}
                                />
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
