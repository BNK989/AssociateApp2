import { Input } from '@/components/ui/input';
import { MAX_SETTLE_DELAY_MS, MIN_SETTLE_INTERVAL_MS } from '@/lib/daily/settlePolicy';

/**
 * One labelled row of the settle panel.
 *
 * A local copy of the `SettingField` shape `GameSettingsForm` uses rather than
 * an import from it: that one is defined inside the form component and is not
 * exported, and reaching into it would couple two panels that are only
 * incidentally alike. Kept small enough that the duplication is cheaper than
 * the coupling — and both should fold into one shared field when the four
 * settings forms are finally generalised.
 */
export function SettleField({ label, hint, control, disabled = false }: {
    label: string;
    hint: string;
    control: React.ReactNode;
    /** Greys the copy as well as the control, so the row reads as inactive. */
    disabled?: boolean;
}) {
    return (
        <div
            className={`flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${
                disabled ? 'opacity-50' : ''
            }`}
        >
            <div className="min-w-0 sm:me-6">
                <div className="text-sm font-medium text-foreground">{label}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </div>
            <div className="shrink-0">{control}</div>
        </div>
    );
}

/**
 * A delay, edited in seconds and stored in milliseconds.
 *
 * The policy is in milliseconds because that is what the clock counts in, and a
 * game master thinks in seconds. Converting at the edge is what keeps both
 * true; the clamp matches the parser's, so the panel cannot offer a value the
 * server will silently rewrite.
 */
export function SecondsInput({ valueMs, onChangeMs, label, disabled }: {
    valueMs: number;
    onChangeMs: (ms: number) => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <Input
            type="number"
            className="w-28"
            aria-label={label}
            disabled={disabled}
            min={Math.ceil(MIN_SETTLE_INTERVAL_MS / 1000)}
            max={Math.floor(MAX_SETTLE_DELAY_MS / 1000)}
            value={Math.round(valueMs / 1000)}
            onChange={(e) => {
                const seconds = Number(e.target.value);
                if (!Number.isFinite(seconds)) return;
                onChangeMs(Math.round(seconds) * 1000);
            }}
        />
    );
}
