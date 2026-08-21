const AVATAR_COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500',
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
    'bg-pink-500', 'bg-rose-500',
];

/** Up to two uppercase initials from a display name, or '??' when unusable. */
export function getInitials(name: string): string {
    return name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??';
}

/**
 * Deterministic avatar colour for a name, so the same player keeps the same
 * colour across sessions and devices.
 */
export function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
