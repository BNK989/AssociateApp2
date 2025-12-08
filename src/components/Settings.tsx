'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Settings() {
    const { user, profile, refreshProfile } = useAuth();
    const [username, setUsername] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [theme, setTheme] = useState('dark');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (profile) {
            setUsername(profile.username || '');
            setAvatarUrl(profile.avatar_url || '');
            setTheme(profile.settings?.theme || 'dark');
        }
    }, [profile]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setMessage('');

        const updates = {
            id: user.id,
            username,
            avatar_url: avatarUrl,
            settings: {
                theme,
                language: profile?.settings?.language || 'en',
                audio_volume: profile?.settings?.audio_volume || 1.0,
            },
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('profiles').upsert(updates);

        if (error) {
            setMessage('Error updating profile');
            console.error(error);
        } else {
            setMessage('Profile updated!');
            await refreshProfile();
        }
        setSaving(false);
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>

            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Display Name</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Avatar URL</label>
                    <input
                        type="text"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Theme</label>
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                    </select>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold">Notifications</h2>

                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">System Notifications</label>
                        <input
                            type="checkbox"
                            checked={profile?.settings?.enable_system_notifications ?? true}
                            onChange={async (e) => {
                                if (user) {
                                    if (e.target.checked && Notification.permission !== 'granted') {
                                        const permission = await Notification.requestPermission();
                                        if (permission !== 'granted') {
                                            toast.error("Permission denied. Please enable notifications in your browser settings.");
                                            return;
                                        }
                                    }
                                    const { error } = await supabase.from('profiles').update({
                                        settings: { ...profile?.settings, enable_system_notifications: e.target.checked }
                                    }).eq('id', user.id);
                                    if (!error) refreshProfile();
                                }
                            }}
                            className="w-4 h-4"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Audio Chime</label>
                        <input
                            type="checkbox"
                            checked={profile?.settings?.enable_audio_chime ?? true}
                            onChange={async (e) => {
                                if (user) {
                                    const { error } = await supabase.from('profiles').update({
                                        settings: { ...profile?.settings, enable_audio_chime: e.target.checked }
                                    }).eq('id', user.id);
                                    if (!error) refreshProfile();
                                }
                            }}
                            className="w-4 h-4"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Tab Title Flash</label>
                        <input
                            type="checkbox"
                            checked={profile?.settings?.enable_title_flash ?? true}
                            onChange={async (e) => {
                                if (user) {
                                    const { error } = await supabase.from('profiles').update({
                                        settings: { ...profile?.settings, enable_title_flash: e.target.checked }
                                    }).eq('id', user.id);
                                    if (!error) refreshProfile();
                                }
                            }}
                            className="w-4 h-4"
                        />
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>

                {message && <p className="text-sm text-gray-300">{message}</p>}
            </div>
        </div>
    );
}
