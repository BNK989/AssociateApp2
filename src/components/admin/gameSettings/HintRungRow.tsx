import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { MAX_RUNG_DELAY_SECONDS, type HintRung, type HintStagger } from '@/lib/daily/hintPolicy';

const RUNG_LABELS = [
    { title: 'Hint 1 — first letter', hint: 'Reveals the word\'s opening letter and its length.' },
    { title: 'Hint 2 — scramble', hint: 'Pins the first letter and reveals most of the rest, scrambled.' },
    { title: 'Hint 3 — AI clue', hint: 'Adds the written clue. This usually gives the answer away.' },
];

type HintRungRowProps = {
    index: number;
    rung: HintRung;
    stagger: HintStagger;
    disabled: boolean;
    onChange: (patch: Partial<HintRung>) => void;
};

/** One rung of the ladder: whether it fires on its own, and after how long. */
export function HintRungRow({ index, rung, stagger, disabled, onChange }: HintRungRowProps) {
    const label = RUNG_LABELS[index];
    const isOff = disabled || !rung.auto;

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{label.title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{label.hint}</p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
                <label className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {stagger === 'cumulative' ? 'at' : 'after'}
                    </span>
                    <Input
                        type="number"
                        min={0}
                        max={MAX_RUNG_DELAY_SECONDS}
                        value={rung.delaySeconds}
                        disabled={isOff}
                        onChange={(e) => onChange({ delaySeconds: Number(e.target.value) })}
                        className="h-9 w-24"
                        aria-label={`${label.title} delay in seconds`}
                    />
                    <span className="text-xs text-muted-foreground">s</span>
                </label>

                <label className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">auto</span>
                    <Switch
                        checked={rung.auto}
                        disabled={disabled}
                        onCheckedChange={(checked) => onChange({ auto: checked })}
                        aria-label={`${label.title} fires automatically`}
                    />
                </label>
            </div>
        </div>
    );
}
