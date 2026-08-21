'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';

type LanguagePickerProps = {
    variant?: 'select' | 'icon';
    className?: string;
};

export function LanguagePicker({ variant = 'select', className }: LanguagePickerProps) {
    const t = useTranslations('Common');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const { user, profile, refreshProfile } = useAuth();

    const onSelectChange = (newLocale: string) => {
        startTransition(async () => {
            // 1. Update Profile if logged in
            if (user) {
                await supabase.from('profiles').update({
                    settings: { ...profile?.settings, language: newLocale }
                }).eq('id', user.id);
                refreshProfile();
            }

            // 2. Navigate to new locale
            router.replace(pathname, { locale: newLocale });
        });
    };

    if (variant === 'icon') {
        return (
            <Select value={locale} onValueChange={onSelectChange} disabled={isPending}>
                <SelectTrigger className={`w-auto p-2 border-0 shadow-none bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors [&>span>svg]:hidden [&>span]:hidden ${className}`}>
                    <Globe className="w-5 h-5" />
                    <span className="sr-only">{t('switch_language')}</span>
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="he">עברית</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="ro">Română</SelectItem>
                </SelectContent>
            </Select>
        );
    }

    return (
        <Select value={locale} onValueChange={onSelectChange} disabled={isPending}>
            <SelectTrigger className={`w-[140px] ${className}`}>
                <Globe className="w-4 h-4 me-2" />
                <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="he">עברית</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ro">Română</SelectItem>
            </SelectContent>
        </Select>
    );
}
