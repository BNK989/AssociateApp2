import { Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LetterLegend } from '@/components/game/LetterLegend';

type LegendButtonProps = {
    /** Current hint level of the word being solved. */
    hintLevel: number;
};

/**
 * The colour key, one tap away from the word it explains.
 *
 * Deliberately always available rather than nudged once: the rules were
 * previously only ever stated in a first-run tour step, so a player who
 * skipped it, played on a second device, or simply forgot had nowhere to look.
 */
export function LegendButton({ hintLevel }: LegendButtonProps) {
    const t = useTranslations('GameRoom.Legend');
    const posthog = usePostHog();

    return (
        <Popover
            onOpenChange={(open) => {
                // Measured so the composer's 48px can be judged on use, not guesswork.
                if (open) posthog?.capture('legend_opened', { source: 'palette', hint_level: hintLevel });
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                    aria-label={t('title')}
                >
                    <Palette className="h-5 w-5" aria-hidden="true" />
                </Button>
            </PopoverTrigger>

            <PopoverContent side="top" align="start" className="w-72">
                <p className="mb-3 text-sm font-bold">{t('title')}</p>
                <LetterLegend positionNote={hintLevel >= 2 ? 'shuffled' : 'ordered'} />
            </PopoverContent>
        </Popover>
    );
}
