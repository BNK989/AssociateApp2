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

type LeaveGameDialogProps = {
    /** The game awaiting confirmation, or null when the dialog is closed. */
    gameId: string | null;
    leaving: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

/** Confirmation before leaving a game, which is irreversible for that player. */
export function LeaveGameDialog({ gameId, leaving, onCancel, onConfirm }: LeaveGameDialogProps) {
    const t = useTranslations('Lobby');

    return (
        <Dialog open={Boolean(gameId)} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle>{t('leave_dialog.title')}</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        {t('leave_dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button variant="ghost" onClick={onCancel} disabled={leaving}>
                        {t('leave_dialog.cancel')}
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={leaving}>
                        {leaving ? t('leave_dialog.leaving') : t('leave_dialog.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
