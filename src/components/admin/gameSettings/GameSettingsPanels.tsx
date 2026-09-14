'use client';

import type { DailyHintPolicy } from '@/lib/daily/hintPolicy';
import type { DailyFeedbackPolicy } from '@/lib/daily/feedbackPolicy';
import type { LetterPoolPolicy } from '@/lib/daily/letterPoolPolicy';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';
import { GameSettingsForm } from './GameSettingsForm';
import { FeedbackSection } from './FeedbackSection';
import { LetterPoolSection } from './LetterPoolSection';
import { SettleSection } from './SettleSection';
import { OutcomesPanel } from './OutcomesPanel';
import { DemoGame } from './demo/DemoGame';
import { useGameSettingsForm, type GameSettingsScope } from './useGameSettingsForm';
import { useFeedbackSettingsForm } from './useFeedbackSettingsForm';
import { useLetterPoolSettingsForm } from './useLetterPoolSettingsForm';
import { useSettleSettingsForm } from './useSettleSettingsForm';
import type { DemoPolicies } from './demo/demoPolicies';

/**
 * The panel page, with the four drafts held one level above the sections.
 *
 * Each section used to mount its own form hook, which was tidy until the demo
 * needed to play the settings back. A demo driven by the saved values would
 * show the game as it is rather than as the game master is about to make it,
 * which is the opposite of what a test board is for — so the drafts have to be
 * readable from outside the section that edits them.
 *
 * They are lifted here rather than published into a context: four hooks and
 * four props is the whole of it, the ownership stays visible, and nothing has
 * to be synchronised in an effect.
 */

type GameSettingsPanelsProps = {
    hint: { policy: DailyHintPolicy; scope: GameSettingsScope; revision: number };
    feedback: { policy: DailyFeedbackPolicy; revision: number };
    letterPool: { policy: LetterPoolPolicy; revision: number };
    settle: { policy: SettlePolicy; revision: number };
    /** True when the settings table has not been migrated yet. */
    usingFallback: boolean;
};

export function GameSettingsPanels(
    { hint, feedback, letterPool, settle, usingFallback }: GameSettingsPanelsProps,
) {
    const hintForm = useGameSettingsForm(hint);
    const feedbackForm = useFeedbackSettingsForm(feedback);
    const letterPoolForm = useLetterPoolSettingsForm(letterPool);
    const settleForm = useSettleSettingsForm(settle);

    // Assembled inline rather than memoised: the demo remounts on any change to
    // it anyway, so a stable identity would buy nothing and hide that.
    const drafts: DemoPolicies = {
        hint: hintForm.policy,
        feedback: feedbackForm.policy,
        letterPool: letterPoolForm.policy,
        settle: settleForm.policy,
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-w-0 space-y-6">
                <GameSettingsForm form={hintForm} usingFallback={usingFallback} />
                <FeedbackSection form={feedbackForm} />
                <LetterPoolSection form={letterPoolForm} />
                <SettleSection form={settleForm} />
                <OutcomesPanel currentRevision={hintForm.revision} />
            </div>

            {/* Pinned, because the point of it is to answer a question about the
                field being edited without scrolling away from that field. */}
            <div className="lg:sticky lg:top-4 lg:self-start">
                <DemoGame policies={drafts} />
            </div>
        </div>
    );
}
