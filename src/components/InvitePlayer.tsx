'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, Check } from 'lucide-react';
import { toast } from "sonner";

type Profile = {
    id: string;
    username: string;
    avatar_url: string;
};

export function InvitePlayer({ gameId }: { gameId: string }) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [invited, setInvited] = useState<Set<string>>(new Set());

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
            toast.success("Invite sent!");
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
            <DialogContent className="sm:max-w-[425px] bg-gray-900 border-gray-800 text-white">
                <DialogHeader>
                    <DialogTitle>Invite Players</DialogTitle>
                </DialogHeader>
                <Command shouldFilter={false} className="bg-transparent border border-gray-700 rounded-md">
                    <CommandInput
                        placeholder="Search username..."
                        value={query}
                        onValueChange={setQuery}
                        className="text-white"
                    />
                    <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup heading="Suggestions">
                            {results.map((profile) => (
                                <CommandItem
                                    key={profile.id}
                                    value={profile.username}
                                    className="flex items-center justify-between p-2 cursor-pointer aria-selected:bg-gray-800"
                                    onSelect={() => !invited.has(profile.id) && sendInvite(profile.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={profile.avatar_url} />
                                            <AvatarFallback className="text-black text-xs">
                                                {getInitials(profile.username)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span>{profile.username}</span>
                                    </div>
                                    {invited.has(profile.id) ? (
                                        <span className="text-green-500 flex items-center gap-1 text-xs">
                                            <Check className="w-3 h-3" /> Sent
                                        </span>
                                    ) : (
                                        <Button size="sm" variant="ghost" className="h-6 text-xs">
                                            Invite
                                        </Button>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
