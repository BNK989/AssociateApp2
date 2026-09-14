import { GameSettingsPanels } from '@/components/admin/gameSettings/GameSettingsPanels';
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
                    Grouped by when the player meets them: what the daily game gives away while a
                    word is unsolved, how the answer box takes typing, what a stuck player is
                    offered before the reveal, and how rewarding a correct guess feels. Changes
                    take effect on the next page load — no deploy needed. The board on the right
                    plays whatever is in the form, saved or not.
                </p>
            </div>

            <GameSettingsPanels
                hint={settings}
                feedback={feedback}
                letterPool={letterPool}
                settle={settle}
                usingFallback={settings.revision === NO_REVISION}
            />
        </div>
    );
}
