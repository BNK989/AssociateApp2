'use client';

import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_LETTER_POOL_POLICY, type LetterPoolPolicy } from '@/lib/daily/letterPoolPolicy';
import { useLetterPoolSettingsForm } from './useLetterPoolSettingsForm';

type LetterPoolSectionProps = {
    policy: LetterPoolPolicy;
    revision: number;
};

/**
 * Game-master control over how the composer's slot strip takes typing.
 *
 * One switch, because there is only one honest choice here. Everything else
 * about the pool — that unplaced letters leave the word line at all — decides
 * what the *word line* draws, which several client modules read directly with
 * no route to a server-side setting; a half-applied switch would be worse than
 * none, so that stays a compiled constant.
 */
export function LetterPoolSection({ policy, revision }: LetterPoolSectionProps) {
    const form = useLetterPoolSettingsForm({ policy, revision });
    const skips = form.policy.caretSkipsGreens;

    return (
        <section className="rounded-lg border border-border bg-background p-5">
            <h2 className="mb-1 text-base font-semibold text-foreground">
                How the answer box takes typing
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
                Found letters sit in a pool above the answer box, where their order cannot be
                mistaken for their position. The box itself shows one slot per letter, with
                confirmed letters already filled in. This decides what happens when the player
                types.
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
                Applies to the <strong>daily game</strong>, like the panels above. A multiplayer
                room is rendered entirely in the browser and has no way to read this without the
                composer changing behaviour mid-word, so it runs on the code default.
            </p>

            <div className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 sm:me-6">
                    <div className="text-sm font-medium text-foreground">
                        Skip over confirmed letters
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        On, the cursor jumps past letters the player has already confirmed, so
                        they type only the gaps and never retype something they earned. Off, they
                        type the whole answer and confirmed letters act as checkpoints that mark a
                        disagreement without blocking the keystroke.
                    </p>
                </div>
                <div className="shrink-0">
                    <Switch
                        checked={skips}
                        onCheckedChange={(c) => form.setField('caretSkipsGreens', c)}
                        aria-label="Skip over confirmed letters"
                    />
                </div>
            </div>

            <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
                <div className="mb-2 text-sm font-medium text-foreground">
                    What the player does
                </div>
                <p className="text-xs text-muted-foreground">
                    {skips
                        ? 'With H, A, R and O confirmed in HARMONY, the player types "mny" — three keystrokes for the three gaps, and the cursor never lands on a confirmed letter.'
                        : 'With H, A, R and O confirmed in HARMONY, the player types the whole word. A keystroke that disagrees with a confirmed letter is marked rather than refused.'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                    Either way an answer submitted through the box is checked exactly, not
                    fuzzily — the box fixes the length and fills letters in, so a wrong letter is
                    simply a wrong answer.
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
                    onClick={() => form.replace(DEFAULT_LETTER_POOL_POLICY)}
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
