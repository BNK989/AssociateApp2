import { GameSettingsForm } from '@/components/admin/gameSettings/GameSettingsForm';
import { FeedbackSection } from '@/components/admin/gameSettings/FeedbackSection';
import { LetterPoolSection } from '@/components/admin/gameSettings/LetterPoolSection';
import { OutcomesPanel } from '@/components/admin/gameSettings/OutcomesPanel';
import {
    getDailyFeedbackSettings,
    getDailyHintSettings,
    getLetterPoolSettings,
    NO_REVISION,
} from '@/lib/gameSettings/server';

export const dynamic = 'force-dynamic';

/**
 * Game-master controls for the daily game.
 *
 * Read on the server so the form opens on the values actually in force rather
 * than flashing the compiled defaults first. Admin access is enforced by the
 * layout, which answers `notFound()` for everyone else.
 */
export default async function GameSettingsPage() {
    const [settings, feedback, letterPool] = await Promise.all([
        getDailyHintSettings(),
        getDailyFeedbackSettings(),
        getLetterPoolSettings(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Game Settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    How the daily game hands out hints, how rewarding a correct guess feels, and
                    how the answer box takes typing.
                    Changes take effect on the next page load — no deploy needed.
                </p>
            </div>

            <GameSettingsForm
                policy={settings.policy}
                scope={settings.scope}
                revision={settings.revision}
                usingFallback={settings.revision === NO_REVISION}
            />

            <FeedbackSection policy={feedback.policy} revision={feedback.revision} />

            <LetterPoolSection policy={letterPool.policy} revision={letterPool.revision} />

            <OutcomesPanel currentRevision={settings.revision} />
        </div>
    );
}
