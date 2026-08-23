'use client';

import { AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DEFAULT_HINT_POLICY, type DailyHintPolicy } from '@/lib/daily/hintPolicy';
import { DemoGame } from './demo/DemoGame';
import { HintRungRow } from './HintRungRow';
import { HintTimeline } from './HintTimeline';
import { useGameSettingsForm, type GameSettingsScope } from './useGameSettingsForm';

type Field = {
    label: string;
    hint: string;
    control: React.ReactNode;
};

function SettingField({ label, hint, control }: Field) {
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-border bg-background p-5">
            <h2 className="mb-1 text-base font-semibold text-foreground">{title}</h2>
            <div>{children}</div>
        </section>
    );
}

type GameSettingsFormProps = {
    policy: DailyHintPolicy;
    scope: GameSettingsScope;
    revision: number;
    /** True when the settings table has not been migrated yet. */
    usingFallback: boolean;
};

export function GameSettingsForm({ policy, scope, revision, usingFallback }: GameSettingsFormProps) {
    const form = useGameSettingsForm({ policy, scope, revision });
    const p = form.policy;

    return (
        <div className="space-y-6">
            {usingFallback && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-sm">
                        <div className="font-medium text-foreground">
                            The settings table has not been created yet
                        </div>
                        <p className="mt-1 text-muted-foreground">
                            The game is running on the compiled defaults. Apply{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">
                                supabase/migrations/20260822140000_create_game_settings.sql
                            </code>{' '}
                            and reload. Saving before then will fail.
                        </p>
                    </div>
                </div>
            )}

            <Section title="Who these apply to">
                <SettingField
                    label="Scope"
                    hint="Default seeds only players who have never touched their own hint settings. Force overrides everyone — including you, which is what you want while balancing."
                    control={(
                        <Select
                            value={form.scope}
                            onValueChange={(v) => form.setScope(v as GameSettingsScope)}
                        >
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default (new players)</SelectItem>
                                <SelectItem value="force">Force (everyone)</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </Section>

            <Section title="How words open">
                <SettingField
                    label="Start level"
                    hint="The hint level a word already carries when the player reaches it. 0 gives nothing away."
                    control={(
                        <Select
                            value={String(p.startLevel)}
                            onValueChange={(v) => form.setField('startLevel', Number(v))}
                        >
                            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">0 — nothing</SelectItem>
                                <SelectItem value="1">1 — first letter</SelectItem>
                                <SelectItem value="2">2 — scramble</SelectItem>
                                <SelectItem value="3">3 — AI clue</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />

                <SettingField
                    label="Applies to"
                    hint="Which words the start level reaches. Every word applies it up front, so the whole board is already hinted before the player gets there; as you reach it holds each word back until it is the one being played."
                    control={(
                        <Select
                            value={p.startLevelAppliesTo}
                            onValueChange={(v) => form.setField('startLevelAppliesTo', v as DailyHintPolicy['startLevelAppliesTo'])}
                        >
                            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="first-word">First word only</SelectItem>
                                <SelectItem value="every-word">Every word, up front</SelectItem>
                                <SelectItem value="every-word-on-arrival">
                                    Every word, as you reach it
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />

                <SettingField
                    label="Charge for the free hint"
                    hint="Whether a hint the player never asked for still costs them points. Turning this off keeps scores comparable when you raise the start level."
                    control={(
                        <Switch
                            checked={p.chargeForStartLevel}
                            onCheckedChange={(c) => form.setField('chargeForStartLevel', c)}
                            aria-label="Charge for the start-level hint"
                        />
                    )}
                />
            </Section>

            <Section title="The automatic ladder">
                <SettingField
                    label="Automatic hints"
                    hint="Master switch. With this off, hints only ever arrive when the player asks for them."
                    control={(
                        <Switch
                            checked={p.autoEnabled}
                            onCheckedChange={(c) => form.setField('autoEnabled', c)}
                            aria-label="Automatic hints enabled"
                        />
                    )}
                />

                <SettingField
                    label="Delays are"
                    hint="Gaps counts each delay from the previous hint. Offsets counts every delay from the moment the word opened."
                    control={(
                        <Select
                            value={p.stagger}
                            onValueChange={(v) => form.setField('stagger', v as DailyHintPolicy['stagger'])}
                        >
                            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="per-rung">Gaps between hints</SelectItem>
                                <SelectItem value="cumulative">Offsets from the word opening</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />

                <SettingField
                    label="Progression"
                    hint="Ladder climbs one level at a time. Jump sends every hint straight to the AI clue."
                    control={(
                        <Select
                            value={p.progression}
                            onValueChange={(v) => form.setField('progression', v as DailyHintPolicy['progression'])}
                        >
                            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ladder">Ladder (1 → 2 → 3)</SelectItem>
                                <SelectItem value="jump">Jump to the AI clue</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />

                <div className="space-y-3 pt-4">
                    {p.rungs.map((rung, i) => (
                        <HintRungRow
                            key={i}
                            index={i}
                            rung={rung}
                            stagger={p.stagger}
                            disabled={!p.autoEnabled}
                            onChange={(patch) => form.setRung(i, patch)}
                        />
                    ))}
                </div>

                <div className="pt-4">
                    <HintTimeline policy={p} />
                </div>
            </Section>

            <Section title="Games already in progress">
                <SettingField
                    label="When these settings change"
                    hint="Keep leaves anyone mid-game alone, so a change lands tomorrow. Restart discards their progress so it takes effect at once."
                    control={(
                        <Select
                            value={p.onRevisionChange}
                            onValueChange={(v) => form.setField('onRevisionChange', v as DailyHintPolicy['onRevisionChange'])}
                        >
                            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="keep">Keep their game</SelectItem>
                                <SelectItem value="restart">Restart their game</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </Section>

            <DemoGame policy={p} />

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <Button onClick={form.save} disabled={!form.isDirty || form.saving}>
                    <Save className="me-2 h-4 w-4" />
                    {form.saving ? 'Saving…' : 'Save'}
                </Button>

                <Button variant="outline" onClick={form.discard} disabled={!form.isDirty || form.saving}>
                    Discard changes
                </Button>

                <Button
                    variant="ghost"
                    onClick={() => form.replace(DEFAULT_HINT_POLICY)}
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
        </div>
    );
}
