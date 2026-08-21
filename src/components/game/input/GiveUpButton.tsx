import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';

type GiveUpButtonProps = {
    disabled: boolean;
    onGiveUp?: () => void;
    /**
     * Anchor for the tutorial's hint step. Set only on the instance that
     * *replaces* the hint button, never on the guest escape hatch that renders
     * beside it — two elements sharing an id would break the anchor.
     */
    id?: string;
};

/**
 * Retires the current word. Replaces the hint button once hints are exhausted,
 * and also appears alongside it for guests, who cannot buy the AI hint and
 * would otherwise have no way past a word they do not know.
 */
export function GiveUpButton({ disabled, onGiveUp, id }: GiveUpButtonProps) {
    const t = useTranslations('GameRoom.Input');

    return (
        <button
            type="button"
            id={id}
            disabled={disabled}
            // Prevent the mobile keyboard closing on press.
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
                e.preventDefault();
                onGiveUp?.();
            }}
            className="h-10 w-10 flex flex-col items-center justify-center rounded-lg transition-colors bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('give_up')}
            aria-label={t('give_up')}
        >
            <Flag className="h-4 w-4" aria-hidden="true" />
        </button>
    );
}
