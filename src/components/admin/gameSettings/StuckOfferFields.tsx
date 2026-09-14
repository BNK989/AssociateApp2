import type { SettlePolicy } from '@/lib/daily/settlePolicy';
import { SettleField, SecondsInput } from './SettleField';
import { ChoiceForkFields } from './ChoiceForkFields';

type StuckOfferFieldsProps = {
    policy: SettlePolicy;
    setField: <K extends keyof SettlePolicy>(key: K, value: SettlePolicy[K]) => void;
};

/**
 * When the stuck offer speaks.
 *
 * Three numbers on the bar's clock, kept apart from the drip's fields below
 * them because they are not the drip's: the bar exists in every mode, `off`
 * included, and it is the first thing a quiet player hears from the game. A
 * game master who finds it nagging or late tunes it here rather than waiting
 * for a deploy -- the constants in `gameConfig.ts` remain the floor beneath.
 */
export function StuckOfferFields({ policy, setField }: StuckOfferFieldsProps) {
    return (
        <>
            <h5 className="mt-4 text-sm font-semibold text-foreground">
                When the game speaks up
            </h5>
            <p className="mb-1 text-xs text-muted-foreground">
                The bar under the board that appears once a player has gone quiet on a word.
                It opens with a reason to keep going, then escalates to a route: a letter, the
                fork composed below, the drip, the other end, the reveal. These clocks run in
                every mode, including <strong>Off</strong>.
            </p>

            <SettleField
                label="First offer after"
                hint="Seconds of quiet on a word before the bar says anything. Lower and it interrupts players who are still thinking; higher and it arrives after they have stopped waiting for it. The hint button starts breathing at 8s regardless."
                control={(
                    <SecondsInput
                        label="First offer after, in seconds"
                        valueMs={policy.stuckFirstOfferMs}
                        onChangeMs={(ms) => setField('stuckFirstOfferMs', ms)}
                    />
                )}
            />

            <SettleField
                label="Help with the word after"
                hint="Seconds before the bar stops encouraging and offers a route. Set it equal to the first offer and the encouragement is skipped; it is never stored below it."
                control={(
                    <SecondsInput
                        label="Help with the word after, in seconds"
                        valueMs={policy.stuckSecondOfferMs}
                        onChangeMs={(ms) => setField('stuckSecondOfferMs', ms)}
                    />
                )}
            />

            <SettleField
                label="A wrong guess is worth"
                hint="Seconds of quiet each wrong guess counts for on this clock. Someone who has guessed and missed is further into being stuck than someone who has only been quiet. Keep it under the first offer so one miss does not summon the bar by itself."
                control={(
                    <SecondsInput
                        label="A wrong guess is worth, in seconds, on the offer clock"
                        valueMs={policy.stuckStrikeWorthMs}
                        onChangeMs={(ms) => setField('stuckStrikeWorthMs', ms)}
                    />
                )}
            />

            <ChoiceForkFields policy={policy} setField={setField} />
        </>
    );
}
