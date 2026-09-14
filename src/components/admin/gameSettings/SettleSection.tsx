'use client';

import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MAX_HINT_LEVEL } from '@/lib/gameConfig';
import { DEFAULT_SETTLE_POLICY, type SettlePolicy } from '@/lib/daily/settlePolicy';
import { useSettleSettingsForm } from './useSettleSettingsForm';
import { SettlePreview } from './SettlePreview';
import { SettleField, SecondsInput } from './SettleField';
import { StuckOfferFields } from './StuckOfferFields';

type SettleSectionProps = {
    policy: SettlePolicy;
    revision: number;
};

/**
 * Game-master control over the settle drip.
 *
 * The copy here is doing real work and is not decoration. This is the one
 * control on the page that can hand a player most of an answer, so every field
 * says what it costs the player as well as what it does — a game master tuning
 * `maxFraction` upward should be able to see, without arithmetic, that they are
 * approaching "the game solves it".
 */
export function SettleSection({ policy, revision }: SettleSectionProps) {
    const form = useSettleSettingsForm({ policy, revision });
    const p = form.policy;
    const off = p.mode === 'off';

    return (
        <section className="rounded-lg border border-border bg-background p-5">
            <h2 className="mb-1 text-base font-semibold text-foreground">
                Letters walking into place
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
                The rung between the last hint and giving up. Found letters — the ones hanging
                around the word with no place yet — walk into their real positions one at a time,
                so a player who is stuck can still finish the word themselves instead of revealing
                it. Below the reveal level set here it gives away{' '}
                <strong>positions, never new letters</strong>: everything it places, the player
                could already see. At and above that level it may also open a letter they have
                not been shown, because by then the only other thing left to offer is the reveal.
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
                Applies to the <strong>daily game</strong> only, like the panels above. The stuck
                offer that leads here is timed at the top; everything below it is the drip.
            </p>

            <StuckOfferFields policy={p} setField={form.setField} />

            <h3 className="mt-6 text-sm font-semibold text-foreground">The drip</h3>

            <SettleField
                label="How it starts"
                hint="Offered waits to be accepted — the game speaks first and the player says yes, which is how every other stuck offer works. Automatic places letters unasked. Off removes the rung and a stuck player's only remaining move is the reveal."
                control={(
                    <Select
                        value={p.mode}
                        onValueChange={(v) => form.setField('mode', v as SettlePolicy['mode'])}
                    >
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="offered">Offered — player accepts</SelectItem>
                            <SelectItem value="auto">Automatic — unasked</SelectItem>
                            <SelectItem value="off">Off</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettleField
                label="Only from hint level"
                hint="The word has to be at least this far up the ladder before any letter will walk into place. Below level 2 there is usually nothing found to place, and offering earlier turns the last rung into a shortcut past the hints."
                disabled={off}
                control={(
                    <Select
                        value={String(p.armFromHintLevel)}
                        onValueChange={(v) => form.setField('armFromHintLevel', Number(v))}
                    >
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">0 — any word</SelectItem>
                            <SelectItem value="1">1 — after the first letter</SelectItem>
                            <SelectItem value="2">2 — after the loose letters</SelectItem>
                            <SelectItem value={String(MAX_HINT_LEVEL)}>
                                3 — only after the AI clue
                            </SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettleField
                label="May open new letters from"
                hint="Up to this level the drip only places letters the player already has: the loose orange ones hint 2 gave them, or that their own wrong guesses found. From this level it may also open a letter they have not seen. Off by default, because with hint 2 filling the pool an opened letter is a fourth hint rather than a repair. It never opens the first letter, which hint 1 already bought, and both ceilings below still bind."
                disabled={off}
                control={(
                    <Select
                        value={p.revealFromHintLevel === null
                            ? 'never'
                            : String(p.revealFromHintLevel)}
                        onValueChange={(v) => form.setField(
                            'revealFromHintLevel', v === 'never' ? null : Number(v),
                        )}
                    >
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="never">Never — found letters only</SelectItem>
                            <SelectItem value="1">1 — after the first letter</SelectItem>
                            <SelectItem value="2">2 — after the second rung</SelectItem>
                            <SelectItem value={String(MAX_HINT_LEVEL)}>
                                3 — only after the AI clue
                            </SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettleField
                label="First letter after"
                hint="Dwell on the word before the first letter lands. Automatic mode only — when the drip is offered, the stuck offer's own timing decides when the player is asked, and accepting lands a letter at once."
                disabled={off || p.mode !== 'auto'}
                control={(
                    <SecondsInput
                        valueMs={p.firstDelayMs}
                        onChangeMs={(ms) => form.setField('firstDelayMs', ms)}
                        label="Seconds before the first letter"
                        disabled={off || p.mode !== 'auto'}
                    />
                )}
            />

            <SettleField
                label="Then one every"
                hint="The gap between letters. This is the pace the player actually feels: short enough that it reads as help arriving, long enough that they get a chance to solve it before the next one."
                disabled={off}
                control={(
                    <SecondsInput
                        valueMs={p.intervalMs}
                        onChangeMs={(ms) => form.setField('intervalMs', ms)}
                        label="Seconds between letters"
                        disabled={off}
                    />
                )}
            />

            <SettleField
                label="A wrong guess is worth"
                hint="Dwell credit for a strike, so a player who has guessed and missed reaches the next letter sooner than one who has merely been quiet. Automatic mode only."
                disabled={off || p.mode !== 'auto'}
                control={(
                    <SecondsInput
                        valueMs={p.strikeCreditMs}
                        onChangeMs={(ms) => form.setField('strikeCreditMs', ms)}
                        label="Seconds of credit per wrong guess"
                        disabled={off || p.mode !== 'auto'}
                    />
                )}
            />

            <SettleField
                label="At most this much of the word"
                hint="Ceiling on the share that may ever settle. Past half, most words are effectively given away."
                disabled={off}
                control={(
                    <Select
                        value={String(p.maxFraction)}
                        onValueChange={(v) => form.setField('maxFraction', Number(v))}
                    >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0.25">A quarter</SelectItem>
                            <SelectItem value="0.34">A third</SelectItem>
                            <SelectItem value="0.5">Half</SelectItem>
                            <SelectItem value="0.67">Two thirds</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettleField
                label="Always leave at least"
                hint="Letters kept back whatever the share above allows. This is the floor that matters on short words: half of a four-letter word is two, and without this a three-letter word would come down to its last letter."
                disabled={off}
                control={(
                    <Select
                        value={String(p.minUnsettled)}
                        onValueChange={(v) => form.setField('minUnsettled', Number(v))}
                    >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1 letter</SelectItem>
                            <SelectItem value="2">2 letters</SelectItem>
                            <SelectItem value="3">3 letters</SelectItem>
                            <SelectItem value="4">4 letters</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettleField
                label="Which letter goes next"
                hint="Left to right hands over the word's opening, which is the strongest clue per letter and spends the allowance fastest. Shuffled spreads them out. Rarest first gives up the letter that narrows the answer most — a Q tells the player far more than an E."
                disabled={off}
                control={(
                    <Select
                        value={p.order}
                        onValueChange={(v) => form.setField('order', v as SettlePolicy['order'])}
                    >
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="seeded">Shuffled (fixed per word)</SelectItem>
                            <SelectItem value="left-to-right">Left to right</SelectItem>
                            <SelectItem value="rare-first">Rarest letter first</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettleField
                label="Each letter costs"
                hint="Fraction of the word's value forfeited per settled letter, on top of the hint tiers. A solve is never worth nothing, whatever this adds up to — it has to stay better than revealing the word, which scores zero, or the rung argues for the very move it exists to prevent."
                disabled={off}
                control={(
                    <Select
                        value={String(p.costPerLetter)}
                        onValueChange={(v) => form.setField('costPerLetter', Number(v))}
                    >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">Nothing</SelectItem>
                            <SelectItem value="0.05">5%</SelectItem>
                            <SelectItem value="0.1">10%</SelectItem>
                            <SelectItem value="0.2">20%</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettleField
                label="The clue costs"
                hint="Fraction of the word's value forfeited for reading the written clue, by any route: the header button and the level-2 choice both charge it. Kept small on purpose — the point is a player who takes help and keeps playing, not one who feels fined for it. Not tied to the drip switch, since the clue is on the ladder either way."
                control={(
                    <Select
                        value={String(p.clueCost)}
                        onValueChange={(v) => form.setField('clueCost', Number(v))}
                    >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">Nothing</SelectItem>
                            <SelectItem value="0.05">5%</SelectItem>
                            <SelectItem value="0.1">10%</SelectItem>
                            <SelectItem value="0.2">20%</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />

            <SettlePreview policy={p} />

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
                    onClick={() => form.replace(DEFAULT_SETTLE_POLICY)}
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
