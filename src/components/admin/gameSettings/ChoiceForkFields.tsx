import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SettlePolicy } from '@/lib/daily/settlePolicy';
import { MIN_CHOICE_OPTIONS, type ChoiceOption } from '@/lib/daily/stuckSignals';
import { SettleField } from './SettleField';
import { moveOption, orderedOptions, toggleOption } from './choiceOptionEdits';

/**
 * The one rung where the game asks instead of handing over.
 *
 * Everywhere else on the stuck ladder the next move is decided for the player.
 * Here they are consulted, and what they are consulted about is composed rather
 * than tuned — which rung asks, and which moves stand side by side on it. So
 * this is a rung picker and a row of switches rather than another clock.
 */

/** The sentinel for "no rung asks", since a `Select` value must be a string. */
const NEVER = 'never';

const RUNGS = [
    { value: '0', label: '0 — before any hint' },
    { value: '1', label: '1 — after the first letter' },
    { value: '2', label: '2 — after the loose letters' },
    { value: '3', label: '3 — after the clue' },
    { value: NEVER, label: 'Never — the ladder never asks' },
];

const OPTION_COPY: Record<ChoiceOption, { label: string; hint: string }> = {
    clue: {
        label: 'The written clue',
        hint: 'The next rung of the hint ladder, taken early. A sentence about the word.',
    },
    place: {
        label: 'Place the loose letters',
        hint: 'Starts the drip below. The only option that can still end in the player solving it.',
    },
    other_end: {
        label: 'Open the other end',
        hint: 'A way off the word rather than help with it. Drops out once the chain is already open from both ends.',
    },
    reveal: {
        label: 'Reveal the word',
        hint: 'Ends the word. Always has something behind it, so it alone can never make the fork stand aside.',
    },
};

type ForkOptionRowProps = {
    option: ChoiceOption;
    /** Its place on the offer, or -1 when it is not on it. */
    position: number;
    /** How many options are on the offer, for disabling the last arrow. */
    count: number;
    disabled: boolean;
    onToggle: () => void;
    onMove: (delta: -1 | 1) => void;
};

function ForkOptionRow(
    { option, position, count, disabled, onToggle, onMove }: ForkOptionRowProps,
) {
    const copy = OPTION_COPY[option];
    const chosen = position >= 0;

    return (
        <div
            className={`flex items-center gap-3 border-b border-border py-3 last:border-b-0 ${
                chosen && !disabled ? '' : 'opacity-60'
            }`}
        >
            <Switch
                checked={chosen}
                onCheckedChange={onToggle}
                disabled={disabled}
                aria-label={`Offer: ${copy.label}`}
            />
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{copy.label}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.hint}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || position <= 0}
                    aria-label={`Move earlier: ${copy.label}`}
                    onClick={() => onMove(-1)}
                >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || !chosen || position >= count - 1}
                    aria-label={`Move later: ${copy.label}`}
                    onClick={() => onMove(1)}
                >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}

type ChoiceForkFieldsProps = {
    policy: SettlePolicy;
    setField: <K extends keyof SettlePolicy>(key: K, value: SettlePolicy[K]) => void;
};

export function ChoiceForkFields({ policy, setField }: ChoiceForkFieldsProps) {
    const chosen = policy.choiceOptions;
    const never = policy.choiceAtHintLevel === null;
    const standsAside = never || chosen.length < MIN_CHOICE_OPTIONS;

    return (
        <>
            <h5 className="mt-6 text-sm font-semibold text-foreground">
                Where the game asks instead
            </h5>
            <p className="mb-1 text-xs text-muted-foreground">
                One rung of the ladder can put two or more moves side by side and let the player
                pick, rather than handing the next one over. The same help either way — what the
                fork adds is the asking, which is the difference between the game giving in and
                the game consulting.
            </p>

            <SettleField
                label="Ask at hint level"
                hint="The rung the fork stands in for. Level 2 by default: the letters are loose in the pool and the clue is still unspent, so the two kinds of help left differ in kind, which is what makes the question worth asking. Never removes the fork and the ladder runs straight through."
                control={(
                    <Select
                        value={never ? NEVER : String(policy.choiceAtHintLevel)}
                        onValueChange={(v) => setField(
                            'choiceAtHintLevel',
                            v === NEVER ? null : Number(v),
                        )}
                    >
                        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {RUNGS.map((rung) => (
                                <SelectItem key={rung.value} value={rung.value}>
                                    {rung.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            />

            <div className={`border-b border-border py-4 ${never ? 'opacity-60' : ''}`}>
                <div className="text-sm font-medium text-foreground">What it offers</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    The buttons on the bar, in the order the player reads them. An option with
                    nothing behind it on a given word — a clue already spent, a chain already open
                    from both ends, no letter left to place — is dropped before the player sees it.
                </p>

                <div className="mt-2">
                    {orderedOptions(chosen).map((option) => (
                        <ForkOptionRow
                            key={option}
                            option={option}
                            position={chosen.indexOf(option)}
                            count={chosen.length}
                            disabled={never}
                            onToggle={() => setField('choiceOptions', toggleOption(chosen, option))}
                            onMove={(delta) => setField(
                                'choiceOptions',
                                moveOption(chosen, option, delta),
                            )}
                        />
                    ))}
                </div>

                {standsAside && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        <strong>The fork is off.</strong> With no rung to ask at, or fewer than two
                        options left on it, the ladder hands the next rung over on its own —
                        exactly as it did before the fork existed.
                    </p>
                )}
            </div>

            <SettleField
                label="Show point costs on the fork"
                hint="Whether the fork buttons carry a points tag (−1 pts, −1 pts each). Off, the player picks without seeing a number; the scoreboard charges the same either way. Only the clue and the letters cost points, so a free option quotes nothing — a button reading 0 pts reads as a bug rather than as generosity."
                disabled={standsAside}
                control={(
                    <Switch
                        checked={policy.showPrices}
                        onCheckedChange={(c) => setField('showPrices', c)}
                        disabled={standsAside}
                        aria-label="Show point costs on the fork"
                    />
                )}
            />
        </>
    );
}
