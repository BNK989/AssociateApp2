'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Settings() {
    const { user, profile, refreshProfile } = useAuth();
    const { theme, setTheme } = useTheme();
    // Start with a local state to avoid hydration mismatch initialized to theme
    const [mounted, setMounted] = useState(false);

    // ... existing state ...
    const [username, setUsername] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    // Removed local theme state, using hook directly
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            setMessage('');

            if (!event.target.files || event.target.files.length === 0) {
                setUploading(false);
                return;
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Resize image to 256x256
            const resizedBlob = await new Promise<Blob>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 256;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }
                    // Draw image with object-cover like behavior or simple resize?
                    // User asked to scale down. Let's do simple drawImage for now to fit, or maybe cover?
                    // Let's preserve aspect ratio and center crop (object-cover) for better avatars

                    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
                    const x = (canvas.width / scale - img.width) / 2;
                    const y = (canvas.height / scale - img.height) / 2;

                    ctx.save();
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, x, y);
                    ctx.restore();

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas to Blob failed'));
                    }, file.type);
                };
                img.onerror = (e) => reject(e);
                img.src = URL.createObjectURL(file);
            });

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, resizedBlob);

            if (uploadError) {
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);
            setMessage('Avatar uploaded successfully! Don\'t forget to save.');

        } catch (error: any) {
            console.error('Upload error details:', error);
            let errorMessage = 'An error occurred during upload';

            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = (error as any).message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else {
                errorMessage = JSON.stringify(error);
            }

            setMessage(`Error uploading avatar: ${errorMessage}`);
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        if (profile) {
            setUsername(profile.username || '');
            setAvatarUrl(profile.avatar_url || '');
            // We don't overwrite local theme preference with profile theme on load anymore
            // to respect the device/browser local storage preference.
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
                theme, // Save current theme to profile for consistency/backup
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

    if (!mounted) return null;

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

                <label className="text-sm font-medium">Avatar</label>
                <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <span className="text-xs">No Img</span>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <input
                            type="file"
                            id="avatar-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                            disabled={uploading || saving}
                        />
                        <button
                            onClick={() => document.getElementById('avatar-upload')?.click()}
                            disabled={uploading || saving}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {uploading ? 'Uploading...' : 'Upload Avatar'}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Max 2MB. Auto-resized to 256x256.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Theme</label>
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="system">System</option>
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
