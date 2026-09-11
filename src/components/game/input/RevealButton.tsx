import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

type RevealButtonProps = {
    disabled: boolean;
    onReveal?: () => void;
    /**
     * Anchor for the tutorial's hint step. Set only on the instance that
     * *replaces* the hint button, never on the guest escape hatch that renders
     * beside it — two elements sharing an id would break the anchor.
     */
    id?: string;
};

/**
 * Shows the player the word. Replaces the hint button once the ladder is
 * exhausted, and also appears alongside it for guests, who cannot buy the AI
 * hint and would otherwise have no way past a word they do not know.
 *
 * This was "Give Up", a red destructive-styled button behind a flag icon, and
 * it read exactly as it was dressed: the one route out of a hard word was
 * styled like an admission of defeat, which is a strange thing to do to a
 * normal move in a game meant to be played daily. It is a reveal now — a
 * neutral action, neutrally dressed — and nothing about the underlying move
 * changed except that it no longer looks like a mistake to make it.
 */
export function RevealButton({ disabled, onReveal, id }: RevealButtonProps) {
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
                onReveal?.();
            }}
            className="h-10 w-10 flex flex-col items-center justify-center rounded-lg transition-colors bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('reveal_word')}
            aria-label={t('reveal_word')}
        >
            <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
    );
}
