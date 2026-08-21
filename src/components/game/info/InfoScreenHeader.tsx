import { Info, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type InfoScreenHeaderProps = {
    isDaily: boolean;
    date?: string;
    dailyTheme?: string;
    onClose: () => void;
};

/** Title bar: the daily puzzle's date and theme, or the generic info title. */
export function InfoScreenHeader({ isDaily, date, dailyTheme, onClose }: InfoScreenHeaderProps) {
    const t = useTranslations('GameRoom.Info');

    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
                {isDaily ? (
                    <span className="flex flex-col items-start leading-tight">
                        <span className="text-xs uppercase text-purple-600 dark:text-purple-400 font-extrabold tracking-wider">
                            {date}
                        </span>
                        <span className="text-lg">{dailyTheme}</span>
                    </span>
                ) : (
                    <>
                        <Info className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        {t('title')}
                    </>
                )}
            </h2>

            <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-800"
            >
                <X className="w-5 h-5" />
            </Button>
        </div>
    );
}
