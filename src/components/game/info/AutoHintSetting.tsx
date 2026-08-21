import { useState } from 'react';
import { Check, ChevronRight, Clock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { IosTimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';
import { SettingRow } from './SettingRow';

type AutoHintSettingProps = {
    enabled: boolean;
    duration: number;
    disabled: boolean;
    onChange: (enabled: boolean, duration: number) => void;
};

/** Auto-hint toggle plus its fold-out delay picker. */
export function AutoHintSetting({ enabled, duration, disabled, onChange }: AutoHintSettingProps) {
    const t = useTranslations('GameRoom.Info');
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            <SettingRow
                icon={<Clock className="w-4 h-4" />}
                tone="amber"
                title={t('auto_hint_title')}
                description={t('auto_hint_desc')}
            >
                <div className="flex items-center gap-2">
                    {enabled && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPickerOpen(!isPickerOpen)}
                            className={cn(
                                'h-7 px-2 text-xs font-bold transition-all duration-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800',
                                isPickerOpen && 'bg-gray-100 dark:bg-gray-800',
                            )}
                        >
                            {duration === 0 ? t('auto_hint_immediate') : `${duration}s`}
                            {isPickerOpen
                                ? <X className="w-3 h-3 ms-2 text-gray-500" />
                                : <ChevronRight className="w-3 h-3 ms-1 transition-transform duration-200" />}
                        </Button>
                    )}

                    <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => {
                            onChange(checked, duration);
                            if (!checked) setIsPickerOpen(false);
                        }}
                        disabled={disabled}
                    />
                </div>
            </SettingRow>

            {/* Grid-rows trick: animates height without needing a measured pixel value. */}
            <div
                className={cn(
                    'grid transition-all duration-300 ease-in-out overflow-hidden',
                    enabled && isPickerOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0',
                )}
            >
                <div className="min-h-0 relative">
                    <div className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                        <IosTimePicker
                            // Remount on open so the wheel starts at the current value.
                            key={isPickerOpen ? 'open' : 'closed'}
                            value={duration}
                            onChange={(val) => onChange(true, val)}
                            immediateLabel={t('auto_hint_immediate')}
                            height={120}
                        />
                        <div
                            className="h-8 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => setIsPickerOpen(false)}
                        >
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
