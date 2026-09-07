'use client';

import { Play, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useRewardFeedback } from '@/hooks/useRewardFeedback';
import { DEFAULT_FEEDBACK_POLICY, type DailyFeedbackPolicy } from '@/lib/daily/feedbackPolicy';
import { SOLVE_TIERS, type SolveTier } from '@/lib/daily/feedbackTiers';
import { useFeedbackSettingsForm } from './useFeedbackSettingsForm';

/** What each tier means, in the words a game master needs rather than in code. */
const TIER_BLURB: Record<SolveTier, string> = {
    assisted: 'Solved after the AI clue. Kept quiet on purpose.',
    solid: 'The everyday solve, with one or two cheap hints.',
    clean: 'No hints taken. The one that should feel earned.',
};

/** Streak rungs offered by the preview, so the ladder can be heard climbing. */
const PREVIEW_STREAKS = [0, 1, 3, 5];

type FeedbackSectionProps = {
    policy: DailyFeedbackPolicy;
    revision: number;
};

function Field({ label, hint, control }: { label: string; hint: string; control: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 sm:me-6">
                <div className="text-sm font-medium text-foreground">{label}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </div>
            <div className="shrink-0">{control}</div>
        </div>
    );
}

/**
 * Game-master controls for how rewarding a correct guess feels.
 *
 * The preview plays the *draft*, not what is saved, which is the whole point of
 * the panel: reward feel is not a thing anyone can judge from a number, so
 * every control here is one button away from being heard. Nothing reaches
 * players until Save.
 */
export function FeedbackSection({ policy, revision }: FeedbackSectionProps) {
    const form = useFeedbackSettingsForm({ policy, revision });
    const p = form.policy;

    // Previewing the draft means the volume and streak-pitch switches above are
    // already applied to what you hear. A preview of the saved policy would be
    // actively misleading while the form is dirty.
    const { preview } = useRewardFeedback(p);

    return (
        <section className="rounded-lg border border-border bg-background p-5">
            <h2 className="mb-1 text-base font-semibold text-foreground">
                How a correct guess feels
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
                Solves are graded on the share of the word&apos;s value the player kept, so a long
                word is not automatically a bigger reward. A player who has muted the game stays
                muted whatever is set here.
            </p>

            <Field
                label="Reward sound"
                hint="Master switch for the solve chime. Players can still turn it off for themselves."
                control={(
                    <Switch
                        checked={p.soundEnabled}
                        onCheckedChange={(c) => form.setField('soundEnabled', c)}
                        aria-label="Reward sound enabled"
                    />
                )}
            />

            <Field
                label="Volume"
                hint="The ceiling. A player's own volume scales this down, never up."
                control={(
                    <div className="flex w-44 items-center gap-3">
                        <Slider
                            value={[p.volume]}
                            min={0}
                            max={1}
                            step={0.05}
                            disabled={!p.soundEnabled}
                            onValueChange={([v]) => form.setField('volume', v)}
                            onValueCommit={() => preview('clean')}
                            aria-label="Reward volume"
                        />
                        <span className="w-9 text-end text-xs tabular-nums text-muted-foreground">
                            {Math.round(p.volume * 100)}%
                        </span>
                    </div>
                )}
            />

            <Field
                label="Streaks raise the pitch"
                hint="Each solve in a streak plays the chime a rung higher up a five-note ladder. Off, the tiers still differ but stop climbing."
                control={(
                    <Switch
                        checked={p.streakPitch}
                        onCheckedChange={(c) => form.setField('streakPitch', c)}
                        disabled={!p.soundEnabled}
                        aria-label="Streaks raise the pitch"
                    />
                )}
            />

            <Field
                label="Wrong-guess tone"
                hint="A short, quiet falling note on a miss. Confirms the guess registered; the shake alone is easy to miss on a phone."
                control={(
                    <Switch
                        checked={p.missSound}
                        onCheckedChange={(c) => form.setField('missSound', c)}
                        disabled={!p.soundEnabled}
                        aria-label="Wrong-guess tone"
                    />
                )}
            />

            <Field
                label="Spark burst from"
                hint="The lowest tier that throws sparks. Set it low and the burst stops meaning anything; 'off' leaves the numbers alone."
                control={(
                    <Select
                        value={p.burstFrom}
                        onValueChange={(v) => form.setField('burstFrom', v as DailyFeedbackPolicy['burstFrom'])}
                    >
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="off">Off — no sparks</SelectItem>
                            <SelectItem value="clean">Clean solves only</SelectItem>
                            <SelectItem value="solid">Solid solves and better</SelectItem>
                            <SelectItem value="assisted">Every solve</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <Field
                label="Flourish"
                hint="Scales the size, travel and spark count of every solve animation. At 0 the points still appear, they just sit still."
                control={(
                    <div className="flex w-44 items-center gap-3">
                        <Slider
                            value={[p.flourish]}
                            min={0}
                            max={1}
                            step={0.1}
                            onValueChange={([v]) => form.setField('flourish', v)}
                            aria-label="Flourish scale"
                        />
                        <span className="w-9 text-end text-xs tabular-nums text-muted-foreground">
                            {Math.round(p.flourish * 100)}%
                        </span>
                    </div>
                )}
            />

            <Field
                label="Haptics"
                hint="A short vibration on phones that support it. Ignored on desktop and on iOS Safari."
                control={(
                    <Switch
                        checked={p.haptics}
                        onCheckedChange={(c) => form.setField('haptics', c)}
                        aria-label="Haptics enabled"
                    />
                )}
            />

            <div className="mt-5 rounded-md border border-border bg-muted/40 p-4">
                <div className="mb-3 text-sm font-medium text-foreground">Hear it</div>

                <div className="space-y-3">
                    {SOLVE_TIERS.map((tier) => (
                        <div key={tier} className="flex items-center gap-3">
                            <div className="flex flex-wrap gap-1">
                                {PREVIEW_STREAKS.map((step) => (
                                    <Button
                                        key={step}
                                        size="sm"
                                        variant="outline"
                                        disabled={!p.soundEnabled}
                                        onClick={() => preview(tier, step)}
                                    >
                                        <Play className="me-1 h-3 w-3" />
                                        {step === 0 ? tier : `+${step}`}
                                    </Button>
                                ))}
                            </div>
                            <span className="min-w-0 text-xs text-muted-foreground">
                                {TIER_BLURB[tier]}
                            </span>
                        </div>
                    ))}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                    The <code>+n</code> buttons play that tier as it sounds on a streak of that many
                    rungs. Sparks and the &ldquo;+points&rdquo; animation are not previewed here —
                    play the daily game to see those.
                </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <Button onClick={form.save} disabled={!form.isDirty || form.saving}>
                    <Save className="me-2 h-4 w-4" />
                    {form.saving ? 'Saving…' : 'Save'}
                </Button>

                <Button variant="outline" onClick={form.discard} disabled={!form.isDirty || form.saving}>
                    Discard changes
                </Button>

                <Button
                    variant="ghost"
                    onClick={() => form.replace(DEFAULT_FEEDBACK_POLICY)}
                    disabled={form.saving}
                >
                    <RotateCcw className="me-2 h-4 w-4" />
                    Reset to code defaults
                </Button>

                <span className="ms-auto text-xs text-muted-foreground">
                    {form.isDirty ? 'Unsaved changes · ' : ''}
                    revision {form.revision}
                </span>
            </div>
        </section>
    );
}
