import { ChevronRight, HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Instruction } from './gameInstructions';

type HowToPlayDialogProps = {
    instructions: Instruction[];
};

/** "How to play" trigger and the scrollable rules dialog behind it. */
export function HowToPlayDialog({ instructions }: HowToPlayDialogProps) {
    const t = useTranslations('GameRoom.Info');

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="secondary"
                    className="flex-1 justify-between h-12 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 border border-gray-800 dark:border-gray-700 shadow-sm px-4"
                >
                    <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5" />
                        <span className="font-bold">{t('how_to_play_title')}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 opacity-50 rtl:rotate-180" />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <div className="space-y-4 pt-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-purple-600 dark:text-purple-400 mb-4">
                            <HelpCircle className="w-6 h-6" />
                            <span>{t('instructions_dialog_title')}</span>
                        </DialogTitle>
                    </DialogHeader>

                    {instructions.map((item) => (
                        <div key={item.title} className="space-y-1">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{item.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{item.text}</p>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
