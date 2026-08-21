import { useTranslations } from 'next-intl';

export type Instruction = {
    title: string;
    text: string;
};

/** Section keys, in the order they are shown. */
const CLASSIC_SECTIONS = ['overview', 'phase1', 'phase2', 'hints', 'winning'] as const;
const DAILY_SECTIONS = ['folder', 'how_to', 'scoring', 'winning'] as const;

/**
 * The "how to play" copy for whichever mode is running. Both modes read from
 * `GameRoom.Info.<Mode>.<section>`, so a new section only needs a key pair in
 * `messages/*.json` plus an entry in the relevant list above.
 */
export function useGameInstructions(isDaily: boolean): Instruction[] {
    const t = useTranslations('GameRoom.Info');
    const prefix = isDaily ? 'Daily' : 'Classic';
    const sections: readonly string[] = isDaily ? DAILY_SECTIONS : CLASSIC_SECTIONS;

    return sections.map((section) => ({
        title: t(`${prefix}.${section}.title` as Parameters<typeof t>[0]),
        text: t(`${prefix}.${section}.text` as Parameters<typeof t>[0]),
    }));
}
