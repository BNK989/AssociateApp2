'use client';

import { Loader2, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShareApp } from '@/hooks/useShareApp';
import type { ShareSurface } from '@/lib/share/appShare';

type ShareAppButtonProps = {
    surface: ShareSurface;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    size?: 'default' | 'sm' | 'lg';
    /** Icon only, with the label read out to assistive tech. For tight headers. */
    compact?: boolean;
    className?: string;
};

/**
 * The one button that passes the game on.
 *
 * Every share surface renders this rather than wiring its own handler, so the
 * wording, the tagged link, and the analytics event stay identical wherever a
 * player finds it.
 */
export function ShareAppButton({
    surface,
    variant = 'outline',
    size = 'default',
    compact = false,
    className,
}: ShareAppButtonProps) {
    const t = useTranslations('Share');
    const { share, sharing } = useShareApp(surface);

    const Icon = sharing ? Loader2 : Share2;

    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            onClick={share}
            disabled={sharing}
            aria-label={t('aria_label')}
            title={t('aria_label')}
            className={cn('gap-2', className)}
        >
            <Icon className={cn('w-4 h-4', sharing && 'animate-spin')} />
            {compact ? <span className="sr-only">{t('button')}</span> : t('button')}
        </Button>
    );
}
