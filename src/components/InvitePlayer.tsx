'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, Check, Link, Share2 } from 'lucide-react';
import { toast } from "sonner";

import { Player } from '@/hooks/useGameLogic';

type Profile = {
    id: string;
    username: string;
    avatar_url: string;
};

export function InvitePlayer({ gameId, players }: { gameId: string; players: Player[] }) {
    const { user, profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [invited, setInvited] = useState<Set<string>>(new Set());
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'invite') {
            setOpen(true);
            // Clean up URL
            const params = new URLSearchParams(searchParams.toString());
            params.delete('action');
            router.replace(`${pathname}?${params.toString()}`);
        }
    }, [searchParams, pathname, router]);

    useEffect(() => {
        if (open) {
            searchUsers();
        }
    }, [open, query]);

    const searchUsers = async () => {
        let queryBuilder = supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .neq('id', user?.id) // Don't show self
            .limit(5);

        if (query.length > 0) {
            queryBuilder = queryBuilder.ilike('username', `%${query}%`);
        }

        const { data, error } = await queryBuilder;

        if (error) {
            console.error('Error searching users:', error);
        } else {
            setResults(data || []);
        }
    };

    const sendInvite = async (receiverId: string) => {
        if (!user) return;

        const { error } = await supabase
            .from('invites')
            .insert({
                game_id: gameId,
                sender_id: user.id,
                receiver_id: receiverId,
                status: 'pending'
            });

        if (error) {
            console.error('Error sending invite:', error);
            toast.error("Failed to send invite");
        } else {
            setInvited(prev => new Set(prev).add(receiverId));
        }
    };

    const getInitials = (name: string) => {
        return name?.slice(0, 2).toUpperCase() || '??';
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Invite
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle>Invite Players</DialogTitle>
                </DialogHeader>

                <div className="mb-4">
                    <Input
                        placeholder="Search username..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="mb-2"
                    />
                    <div className="h-64 border border-gray-200 dark:border-gray-700 rounded-md overflow-y-auto p-1">
                        {results.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500">No users found.</div>
                        ) : (
                            <div className="space-y-1">
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Suggestions</div>
                                {results.map((profile) => (
                                    <div
                                        key={profile.id}
                                        className="flex items-center justify-between p-2 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                        onClick={() => {
                                            const isJoined = players.some(p => p.user_id === profile.id);
                                            if (!isJoined && !invited.has(profile.id)) {
                                                sendInvite(profile.id);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-8 h-8">
                                                <AvatarImage src={profile.avatar_url} />
                                                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">
                                                    {getInitials(profile.username)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span>{profile.username}</span>
                                        </div>
                                        {players.some(p => p.user_id === profile.id) ? (
                                            <span className="text-blue-500 flex items-center gap-1 text-xs font-bold">
                                                <Check className="w-3 h-3" /> Joined
                                            </span>
                                        ) : invited.has(profile.id) ? (
                                            <span className="text-green-500 flex items-center gap-1 text-xs">
                                                <Check className="w-3 h-3" /> Sent
                                            </span>
                                        ) : (
                                            <Button size="sm" variant="ghost" className="h-6 text-xs">
                                                Invite
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-200 dark:border-gray-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">Or invite via link</span>
                        </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1 gap-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-purple-500 hover:text-purple-500 dark:hover:text-purple-400"
                                onClick={() => {
                                    let link = `${window.location.origin}/join/${gameId}`;
                                    if (profile?.username) {
                                        link += `?invitedBy=${encodeURIComponent(profile.username)}`;
                                    }
                                    navigator.clipboard.writeText(link);
                                    toast.success("Link copied to clipboard!");
                                }}
                            >
                                <Link className="w-4 h-4" />
                                <span className="text-xs">Copy Link</span>
                            </Button>

                            {typeof navigator !== 'undefined' && navigator.share && (
                                <Button
                                    variant="secondary"
                                    className="flex-1 gap-2"
                                    onClick={() => {
                                        let link = `${window.location.origin}/join/${gameId}`;
                                        if (profile?.username) {
                                            link += `?invitedBy=${encodeURIComponent(profile.username)}`;
                                        }
                                        navigator.share({
                                            title: 'Join my game!',
                                            text: 'Come play with me!',
                                            url: link
                                        }).catch((err) => console.log('Error sharing:', err));
                                    }}
                                >
                                    <Share2 className="w-4 h-4" />
                                    <span className="text-xs">Share</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    <Button onClick={() => setOpen(false)} className="w-full">
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
