'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, Check, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Invite = {
    id: string;
    game_id: string;
    sender_id: string;
    created_at: string;
    sender: {
        username: string;
    };
    game: {
        id: string;
        mode: string;
    };
};

type Notification = {
    id: string;
    type: string;
    content: string;
    is_read: boolean;
    created_at: string;
    metadata?: Record<string, unknown>;
};

export function NotificationCenter() {
    const { user } = useAuth();
    const router = useRouter();
    const [invites, setInvites] = useState<Invite[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const fetchData = useCallback(async () => {
        if (!user) return;

        // Fetch Invites
        const { data: inviteData } = await supabase
            .from('invites')
            .select(`
                id,
                game_id,
                sender_id,
                created_at,
                sender:sender_id (username),
                game:game_id (id, mode)
            `)
            .eq('receiver_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (inviteData) setInvites(inviteData as unknown as Invite[]);

        // Fetch Notifications
        const { data: notifData } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false });

        if (notifData) setNotifications(notifData as Notification[]);
    }, [user]);

    const handleAccept = async (inviteId: string, gameId: string) => {
        // 1. Update invite status
        await supabase
            .from('invites')
            .update({ status: 'accepted' })
            .eq('id', inviteId);

        // 2. Add to game_players (if not already)
        const { error } = await supabase
            .from('game_players')
            .insert({
                game_id: gameId,
                user_id: user?.id,
                score: 0
            });

        if (error && error.code !== '23505') {
            console.error("Error joining game:", error);
            toast.error("Failed to join game");
        } else {
            toast.success("Joined game!");
            router.push(`/game/${gameId}`);
            setInvites(prev => prev.filter(i => i.id !== inviteId));
        }
    };

    const handleDecline = async (inviteId: string) => {
        await supabase
            .from('invites')
            .update({ status: 'declined' })
            .eq('id', inviteId);

        setInvites(prev => prev.filter(i => i.id !== inviteId));
        toast.info("Invite declined");
    };

    const markAsRead = async (notificationId: string) => {
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    useEffect(() => {
        if (user) {
            fetchData();

            // Subscribe to Invites
            const inviteChannel = supabase
                .channel(`invites:${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'invites',
                    filter: `receiver_id=eq.${user.id}`
                }, async (payload) => {
                    // Fetch sender name for the toast
                    const { data: senderData } = await supabase
                        .from('profiles')
                        .select('username')
                        .eq('id', payload.new.sender_id)
                        .single();

                    const senderName = senderData?.username || 'Someone';

                    toast.custom((t) => (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg p-4 shadow-lg w-full flex flex-col gap-3 pointer-events-auto">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-sm">{senderName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">invited you to play!</p>
                                </div>
                                <button onClick={() => toast.dismiss(t)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                    onClick={() => {
                                        handleAccept(payload.new.id, payload.new.game_id);
                                        toast.dismiss(t);
                                    }}
                                >
                                    Accept
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-8 text-xs border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                                    onClick={() => {
                                        handleDecline(payload.new.id);
                                        toast.dismiss(t);
                                    }}
                                >
                                    Decline
                                </Button>
                            </div>
                        </div>
                    ), { duration: 10000 });

                    fetchData();
                })
                .subscribe();

            // Subscribe to Notifications
            const notifChannel = supabase
                .channel(`notifications:${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    toast.info(payload.new.content);
                    setNotifications(prev => [payload.new as Notification, ...prev]);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(inviteChannel);
                supabase.removeChannel(notifChannel);
            };
        }
    }, [user, fetchData]);

    const totalCount = invites.length + notifications.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5" />
                    {totalCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[18px] h-[18px] text-[10px] flex items-center justify-center bg-red-500 hover:bg-red-600 border-none">
                            {totalCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white max-h-[400px] overflow-y-auto">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-800" />

                {totalCount === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No new notifications
                    </div>
                ) : (
                    <>
                        {/* Invites Section */}
                        {invites.map((invite) => (
                            <DropdownMenuItem key={invite.id} className="flex flex-col items-start gap-2 p-3 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-default border-b border-gray-200 dark:border-gray-800 last:border-0">
                                <div className="text-sm">
                                    <span className="font-bold text-purple-600 dark:text-purple-400">{invite.sender.username}</span> invited you to play <span className="font-bold">Game #{invite.game.id.slice(0, 4)}</span>
                                </div>
                                <div className="flex gap-2 w-full mt-1">
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-green-600 hover:bg-green-700 h-7 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAccept(invite.id, invite.game_id);
                                        }}
                                    >
                                        <Check className="w-3 h-3 mr-1" /> Accept
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-7 text-xs border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDecline(invite.id);
                                        }}
                                    >
                                        <X className="w-3 h-3 mr-1" /> Decline
                                    </Button>
                                </div>
                            </DropdownMenuItem>
                        ))}

                        {/* General Notifications Section */}
                        {notifications.map((notif) => (
                            <DropdownMenuItem key={notif.id} className="flex flex-col items-start gap-2 p-3 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-default border-b border-gray-200 dark:border-gray-800 last:border-0">
                                <div className="text-sm text-gray-600 dark:text-gray-200">
                                    {notif.content}
                                </div>
                                <div className="flex justify-end w-full">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            markAsRead(notif.id);
                                        }}
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
