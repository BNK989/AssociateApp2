import { GameSettingsForm } from '@/components/admin/gameSettings/GameSettingsForm';
import { FeedbackSection } from '@/components/admin/gameSettings/FeedbackSection';
import { LetterPoolSection } from '@/components/admin/gameSettings/LetterPoolSection';
import { SettleSection } from '@/components/admin/gameSettings/SettleSection';
import { OutcomesPanel } from '@/components/admin/gameSettings/OutcomesPanel';
import {
    getDailyFeedbackSettings,
    getDailyHintSettings,
    getLetterPoolSettings,
    getSettleSettings,
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
    const [settings, feedback, letterPool, settle] = await Promise.all([
        getDailyHintSettings(),
        getDailyFeedbackSettings(),
        getLetterPoolSettings(),
        getSettleSettings(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Game Settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    How the daily game hands out hints, how rewarding a correct guess feels, how
                    the answer box takes typing, and what a stuck player is offered before the
                    reveal. Changes take effect on the next page load — no deploy needed.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Looking for the points tags on the stuck offer? That switch is{' '}
                    <strong>Show point costs on the stuck offer</strong>, in the last panel.
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

            <SettleSection policy={settle.policy} revision={settle.revision} />

            <OutcomesPanel currentRevision={settings.revision} />
        </div>
    );
}
