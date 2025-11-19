'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { NotificationCenter } from './NotificationCenter';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function NavBar() {
    const { user, profile } = useAuth();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    if (!user) return null;

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
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium hidden sm:block text-gray-200">
                                {profile?.username || 'User'}
                            </span>
                            <Avatar className="w-8 h-8 border border-gray-700">
                                <AvatarImage src={profile?.avatar_url} />
                                <AvatarFallback className="bg-purple-900 text-xs text-white">
                                    {getInitials(profile?.username || '')}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSignOut}
                            className="text-gray-400 hover:text-white hover:bg-gray-800"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
