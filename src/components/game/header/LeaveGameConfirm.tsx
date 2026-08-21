import { useTranslations } from 'next-intl';

type LeaveGameConfirmProps = {
    onLeavePermanently: () => void;
    onGoHome: () => void;
    onCancel: () => void;
};

/**
 * Offers the two different ways of backing out of a game, which are easy to
 * confuse: leaving for good, or just navigating away and keeping your seat.
 */
export function LeaveGameConfirm({ onLeavePermanently, onGoHome, onCancel }: LeaveGameConfirmProps) {
    const t = useTranslations('GameRoom.Header');

    const stop = (handler: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        handler();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl max-w-xs w-full border border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {t('back_confirm_title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t('back_confirm_msg')}
                </p>

                <div className="flex flex-col gap-2 w-full">
                    <button
                        onClick={stop(onLeavePermanently)}
                        className="w-full px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded"
                    >
                        {t('leave_perm')}
                    </button>
                    <button
                        onClick={stop(onGoHome)}
                        className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                        {t('go_home')}
                    </button>
                    <button
                        onClick={stop(onCancel)}
                        className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
}
