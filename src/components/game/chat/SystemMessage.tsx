import { useTranslations } from 'next-intl';

type SystemMessageProps = {
    content: string;
    /** True when the current viewer is the player the message is about. */
    isOwnEvent: boolean;
};

/**
 * Centred pill for lifecycle events (joins, mode switches).
 *
 * System messages are written to the DB in English by the server, so they are
 * matched here and re-rendered through i18n rather than shown verbatim. An
 * unrecognised message falls through to its raw text.
 */
export function SystemMessage({ content, isOwnEvent }: SystemMessageProps) {
    const t = useTranslations('GameRoom.Chat');

    const label = (() => {
        if (isOwnEvent && content.includes('joined the game')) {
            return t('you_joined');
        }

        const joinMatch = content.match(/^Player (.+) joined the game$/);
        if (joinMatch) {
            return t('player_joined', { user: joinMatch[1] });
        }

        if (content.includes('Solving Mode Activated')) {
            return t('system_solving_mode');
        }

        return content;
    })();

    return (
        <div className="flex justify-center animate-in fade-in zoom-in duration-300">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                {label}
            </span>
        </div>
    );
}
