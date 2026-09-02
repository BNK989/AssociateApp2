'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { NotificationCenter } from './NotificationCenter';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, Sun, Moon, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { deleteGuestAccount } from '@/app/actions/auth';
import { useTheme } from 'next-themes';
import { useAdmin } from '@/hooks/useAdmin';

import { usePathname } from 'next/navigation';
import { createLogger } from '@/lib/logger';

const log = createLogger('navbar');

export function NavBar() {
    const t = useTranslations('NavBar');
    const locale = useLocale();
    const dir = locale === 'he' ? 'rtl' : 'ltr';
    const { user, profile, refreshProfile } = useAuth();
    const { setTheme, resolvedTheme } = useTheme();
    const { isAdmin } = useAdmin();
    const pathname = usePathname();

    const handleSignOut = async () => {
        if (user?.is_anonymous) {
            try {
                await deleteGuestAccount();
            } catch (e) {
                log.error('delete_guest', 'Failed to delete guest account', { user_id: user?.id }, e);
            }
        }
        await supabase.auth.signOut();

        // Fail-safe: Clear all local storage and cookies to ensure a clean slate
        localStorage.clear();
        sessionStorage.clear();
        // clear all cookies
        document.cookie.split(";").forEach((c) => {
            document.cookie = c
                .replace(/^ +/, "")
                .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        // Force reload to apply changes
        window.location.href = '/';
    };

    const toggleTheme = async () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);

        if (user && !user.is_anonymous) {
            try {
                const { error } = await supabase.from('profiles').update({
                    settings: {
                        ...profile?.settings,
                        theme: newTheme
                    }
                }).eq('id', user.id);

                if (!error) {
                    await refreshProfile();
                }
            } catch (e) {
                log.error('update_theme', 'Failed to save theme preference', { user_id: user?.id }, e);
            }
        }
    };

    if (!user) return null;
    if (pathname?.startsWith('/game/')) return null;

    const getInitials = (name: string) => {
        return name?.slice(0, 2).toUpperCase() || '??';
    };

    return (
        <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl hover:opacity-80 transition-opacity">
                    <img src="/icon-192x192.png" alt="Associate Icon" className="w-8 h-8 rounded-lg" />
                    <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        Associate
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    <NotificationCenter />

                    <div className="flex items-center gap-3 ps-4 border-s border-gray-200 dark:border-gray-800">
                        <DropdownMenu dir={dir}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                                        <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.username ?? undefined} />
                                        <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-white text-xs">
                                            {getInitials(profile?.username || user?.user_metadata?.username || t('guest_badge'))}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal min-w-[200px]">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex flex-col space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium leading-none">{profile?.username || user?.user_metadata?.username || t('guest_badge')}</p>
                                                {user.is_anonymous && (
                                                    <span className="text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">
                                                        {t('guest_badge')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
                                                {user.is_anonymous ? t('guest_message') : user.email}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleTheme();
                                            }}
                                        >
                                            {resolvedTheme === 'dark' ? (
                                                <Sun className="h-4 w-4" />
                                            ) : (
                                                <Moon className="h-4 w-4" />
                                            )}
                                            <span className="sr-only">{t('theme_toggle')}</span>
                                        </Button>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-800" />
                                <DropdownMenuItem asChild className="focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer">
                                    <Link href="/settings">
                                        {t('preferences')}
                                    </Link>
                                </DropdownMenuItem>
                                {isAdmin && (
                                    <DropdownMenuItem asChild className="focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer">
                                        <Link href="/admin">
                                            <ShieldCheck className="me-2 h-4 w-4" />
                                            {t('admin')}
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-800" />
                                <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer"
                                    onClick={handleSignOut}
                                >
                                    <LogOut className="me-2 h-4 w-4" />
                                    <span>{t('logout')}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </nav>
    );
}
