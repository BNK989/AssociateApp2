'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';

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
