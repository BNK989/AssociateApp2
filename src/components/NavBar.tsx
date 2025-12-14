'use client';

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
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { deleteGuestAccount } from '@/app/actions/auth';

import { usePathname } from 'next/navigation';

export function NavBar() {
    const { user, profile } = useAuth();
    const pathname = usePathname();

    const handleSignOut = async () => {
        if (user?.is_anonymous) {
            try {
                await deleteGuestAccount();
            } catch (e) {
                console.error("Error calling deleteGuestAccount:", e);
            }
        }
        await supabase.auth.signOut();
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

                    <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-800">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                                        <AvatarImage src={profile?.avatar_url} alt={profile?.username} />
                                        <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-white text-xs">
                                            {getInitials(profile?.username || user?.user_metadata?.username || 'Guest')}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium leading-none">{profile?.username || user?.user_metadata?.username || 'Guest'}</p>
                                            {user.is_anonymous && (
                                                <span className="text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">
                                                    Guest
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
                                            {user.is_anonymous ? 'Sign up to save progress' : user.email}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-800" />
                                <DropdownMenuItem asChild className="focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer">
                                    <Link href="/settings">
                                        Preferences
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-800" />
                                <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer"
                                    onClick={handleSignOut}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </nav>
    );
}
