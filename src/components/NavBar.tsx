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

import { usePathname } from 'next/navigation';

export function NavBar() {
    const { user, profile } = useAuth();
    const pathname = usePathname();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    if (!user) return null;
    if (pathname?.startsWith('/game/')) return null;

    const getInitials = (name: string) => {
        return name?.slice(0, 2).toUpperCase() || '??';
    };

    return (
        <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                <Link href="/" className="font-bold text-xl bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                    Associate
                </Link>

                <div className="flex items-center gap-4">
                    <NotificationCenter />

                    <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8 border border-gray-700">
                                        <AvatarImage src={profile?.avatar_url} alt={profile?.username} />
                                        <AvatarFallback className="bg-purple-900 text-xs text-white">
                                            {getInitials(profile?.username || '')}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-gray-900 border-gray-800 text-white" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{profile?.username}</p>
                                        <p className="text-xs leading-none text-gray-400">
                                            {user.email}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-gray-800" />
                                <DropdownMenuItem asChild className="focus:bg-gray-800 cursor-pointer">
                                    <Link href="/settings">
                                        Preferences
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-800" />
                                <DropdownMenuItem
                                    className="text-red-400 focus:text-red-400 focus:bg-gray-800 cursor-pointer"
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
