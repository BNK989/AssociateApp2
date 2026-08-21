'use client';
import { useTranslations } from 'next-intl';
import { LanguagePicker } from '@/components/LanguagePicker';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Volume2 } from 'lucide-react';
import DebugSettings from '@/components/settings/DebugSettings';
import { createLogger, getErrorMessage } from '@/lib/logger';

const log = createLogger('settings');

export default function Settings() {
    const t = useTranslations('Settings');
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
            setMessage(t('upload_success'));

        } catch (error: unknown) {
            log.error('upload_avatar', 'Avatar upload failed', { user_id: user?.id }, error);
            const errorMessage = getErrorMessage(error, t('upload_error_generic'));

            setMessage(t('upload_error', { message: errorMessage }));
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
            setMessage(t('update_error'));
            log.error('save_profile', 'Failed to save profile', { user_id: user?.id }, error);
        } else {
            setMessage(t('update_success'));
            await refreshProfile();
        }
        setSaving(false);
    };

    if (!mounted) return null;

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t('display_name')}</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                <label className="text-sm font-medium">{t('avatar')}</label>
                <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <span className="text-xs">{t('no_img')}</span>
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
                            {uploading ? t('uploading') : t('upload_avatar')}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('upload_hint')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t('theme')}</label>
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="p-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="system">{t('theme_options.system')}</option>
                        <option value="dark">{t('theme_options.dark')}</option>
                        <option value="light">{t('theme_options.light')}</option>
                    </select>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">{t('language')}</label>
                    <LanguagePicker className="w-full" />
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold">{t('notifications')}</h2>

                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">{t('system_notifications')}</label>
                        <input
                            type="checkbox"
                            checked={profile?.settings?.enable_system_notifications ?? true}
                            onChange={async (e) => {
                                if (user) {
                                    if (e.target.checked && Notification.permission !== 'granted') {
                                        const permission = await Notification.requestPermission();
                                        if (permission !== 'granted') {
                                            toast.error(t('permission_denied'));
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
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">{t('audio_chime')}</label>
                            <Volume2
                                className="w-4 h-4 text-gray-400 cursor-pointer hover:text-purple-600 transition-colors active:scale-95"
                                onClick={() => {
                                    new Audio('/sounds/notifications/chime1.mp3').play().catch((e) => log.warn('play_audio', 'Chime preview playback failed', undefined, e));
                                }}
                            />
                        </div>
                        <input
                            type="checkbox"
                            checked={profile?.settings?.enable_audio_chime ?? true}
                            onChange={async (e) => {
                                if (user) {
                                    const enabled = e.target.checked;
                                    const { error } = await supabase.from('profiles').update({
                                        settings: { ...profile?.settings, enable_audio_chime: enabled }
                                    }).eq('id', user.id);

                                    if (!error) {
                                        refreshProfile();
                                        if (enabled) {
                                            const audio = new Audio('/sounds/notifications/chime1.mp3');
                                            audio.play().catch((e) => log.warn('play_audio', 'Chime playback failed', undefined, e));
                                        }
                                    }
                                }
                            }}
                            className="w-4 h-4"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">{t('tab_title_flash')}</label>
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

                <DebugSettings />

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                    {saving ? t('saving') : t('save_changes')}
                </button>

                {message && <p className="text-sm text-gray-300">{message}</p>}
            </div>
        </div>
    );
}
