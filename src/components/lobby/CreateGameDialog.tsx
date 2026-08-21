import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { GAME_MODES } from '@/lib/gameConfig';

type CreateGameDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creating: boolean;
    onCreate: (modeId: string) => void;
};

/** Game-length picker shown before a new game is created. */
export function CreateGameDialog({ open, onOpenChange, creating, onCreate }: CreateGameDialogProps) {
    const t = useTranslations('Lobby');
    const [selectedModeId, setSelectedModeId] = useState(GAME_MODES[0].id);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('create_dialog.title')}</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        {t('create_dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Label className="text-base font-semibold mb-3 block">
                        {t('create_dialog.game_length')}
                    </Label>

                    <div className="grid grid-cols-2 gap-3">
                        {GAME_MODES.map((mode) => {
                            const isSelected = selectedModeId === mode.id;

                            return (
                                <button
                                    key={mode.id}
                                    onClick={() => setSelectedModeId(mode.id)}
                                    className={`p-3 rounded-lg border text-start transition-all ${isSelected
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                                        }`}
                                >
                                    <div className={`font-bold ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                                        {mode.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('create_dialog.max_messages', { count: mode.limit })}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded">
                        {t('create_dialog.note')}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
                        {t('create_dialog.cancel')}
                    </Button>
                    <Button
                        onClick={() => onCreate(selectedModeId)}
                        disabled={creating}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {creating ? t('create_dialog.creating') : t('create_dialog.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
