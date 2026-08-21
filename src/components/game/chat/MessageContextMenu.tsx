import { useTranslations } from 'next-intl';
import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from '@/components/ui/context-menu';

type MessageContextMenuProps = {
    messageId: string;
    isRevealed: boolean;
    onAdminAction: (action: string, messageId: string) => void;
    onForceScramble: () => void;
    onTestEndSequence?: () => void;
    onResetGame?: () => void;
};

/**
 * Admin-only tools on a chat message. The caller decides whether to render it;
 * this component assumes the viewer is already known to be an admin.
 */
export function MessageContextMenu({
    messageId,
    isRevealed,
    onAdminAction,
    onForceScramble,
    onTestEndSequence,
    onResetGame,
}: MessageContextMenuProps) {
    const t = useTranslations('GameRoom.Chat');

    return (
        <ContextMenuContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
            <ContextMenuItem
                onClick={() => onAdminAction('show_content', messageId)}
                className="cursor-pointer"
            >
                {isRevealed ? t('menu.hide') : t('menu.reveal')}
            </ContextMenuItem>

            <ContextMenuSub>
                <ContextMenuSubTrigger disabled className="cursor-not-allowed text-gray-400">
                    Trigger Hint (Disabled)
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <ContextMenuItem disabled className="cursor-not-allowed">Hint 1</ContextMenuItem>
                </ContextMenuSubContent>
            </ContextMenuSub>

            <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

            <ContextMenuItem
                onClick={() => onAdminAction('delete', messageId)}
                className="text-red-600 focus:bg-gray-800 focus:text-red-500 cursor-pointer font-bold"
            >
                {t('menu.delete')}
            </ContextMenuItem>

            {onTestEndSequence && (
                <>
                    <div className="h-px bg-gray-200 dark:bg-gray-800 my-1" />
                    <ContextMenuItem
                        onClick={onTestEndSequence}
                        className="text-purple-600 focus:bg-gray-800 focus:text-purple-500 cursor-pointer font-bold"
                    >
                        {t('menu.test_end')}
                    </ContextMenuItem>
                </>
            )}

            <ContextMenuItem
                onClick={onForceScramble}
                className="text-blue-600 focus:bg-gray-800 focus:text-blue-500 cursor-pointer font-bold"
            >
                {t('menu.test_scramble')}
            </ContextMenuItem>

            {onResetGame && (
                <ContextMenuItem
                    onClick={() => {
                        if (confirm('Are you sure you want to completely reset this daily game?')) {
                            onResetGame();
                        }
                    }}
                    className="text-orange-600 focus:bg-gray-800 focus:text-orange-500 cursor-pointer font-bold"
                >
                    {t('menu.reset')}
                </ContextMenuItem>
            )}
        </ContextMenuContent>
    );
}
