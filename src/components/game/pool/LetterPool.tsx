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
 * The letters are held in a **seeded order that is not the answer's**, and the
 * pool is drawn so that it does not look like it has an order at all: no
 * heading, no shared baseline, no even rhythm — irregular gaps, each tile
 * lifted and angled by its own seed. That pairing is the point. Scrambling
 * silently would only mean the row lies more quietly; a row still reads as a
 * sequence, and a player who trusts it draws a false lead about how the word
 * starts. Saying it in words instead — a "shuffled" badge — would assert that
 * there *is* an order here to recover, which is the opposite of true once the
 * letters are outside the sentence. So the arrangement carries it, and the one
 * sentence of teaching lives in the legend (`Legend.pool_note`).
 *
 * Three things keep it affordable on a phone:
 *
 * - It collapses to nothing when the pool is empty, which is most of a word.
 * - It is always exactly one row. Too many letters scroll sideways rather than
 *   wrapping, so the board's height never moves under the player's thumb. The
 *   scatter is vertical jitter *within* a fixed band (`MAX_LIFT_PX`), never
 *   free positioning, for the same reason.
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
                    <div dir={dir} className="flex items-center pb-1 max-[660px]:pb-0.5">
                        <div
                            // One row, always. Overflow scrolls rather than wrapping,
                            // so a long phrase cannot push the board upward.
                            //
                            // No flex `gap`: the spacing between tiles is seeded
                            // per tile (`--pool-gap`), because a uniform rhythm is
                            // half of what makes a row read as a sequence.
                            className="pool-track flex min-w-0 flex-1 items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            aria-label={t('aria_label', { count: letters.length })}
                        >
                            {letters.map((letter, order) => (
                                <PoolTile
                                    key={letter.id}
                                    order={order}
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
