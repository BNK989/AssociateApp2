type SolvedMessage = {
    id: string;
    /** Author of the word. */
    user_id: string;
    solved_by?: string;
    winner_points?: number;
    author_points?: number;
};

type PlayerProfile = {
    user_id: string;
    profiles?: { username: string; avatar_url: string };
};

/**
 * A steal is someone solving a word that is not theirs, for points.
 *
 * Solving your own word is ordinary; a zero-point solve is a give-up or a
 * third strike, neither of which is worth celebrating.
 */
export function isStealEvent(message: SolvedMessage): boolean {
    return Boolean(message.solved_by)
        && Boolean(message.user_id)
        && message.solved_by !== message.user_id
        && (message.winner_points ?? 0) > 0;
}

export type StealAnimation = {
    stealerName: string;
    stealerAvatar: string;
    authorName: string;
};

/**
 * Names for the steal animation, which every player sees — so it is written
 * from the viewer's perspective, with "You" substituted wherever they appear.
 *
 * Falls back to placeholder names when a player is not in the local roster yet,
 * which can happen for someone who joined moments ago.
 */
export function getStealAnimation(
    message: SolvedMessage,
    currentUserId: string,
    players: PlayerProfile[],
): StealAnimation {
    const solver = players.find((p) => p.user_id === message.solved_by);

    if (!solver?.profiles) {
        return { stealerName: 'Thief', stealerAvatar: '', authorName: 'Someone' };
    }

    const authorName = message.user_id === currentUserId
        ? 'You'
        : players.find((p) => p.user_id === message.user_id)?.profiles?.username || 'Unknown';

    return {
        stealerName: message.solved_by === currentUserId ? 'You' : solver.profiles.username,
        stealerAvatar: solver.profiles.avatar_url,
        authorName,
    };
}

/**
 * Points to float for this viewer, or null if they earned none.
 *
 * Each player sees only their own: the solver sees what they won, and on a
 * steal the author sees their consolation share. A player who is neither sees
 * nothing, which is what keeps the display from lying about someone else's
 * score.
 */
export function getPointsToShow(
    message: SolvedMessage,
    currentUserId: string,
): number | null {
    if (message.solved_by === currentUserId) {
        const points = message.winner_points ?? 0;
        return points > 0 ? points : null;
    }

    if (message.user_id === currentUserId) {
        const points = message.author_points ?? 0;
        return points > 0 ? points : null;
    }

    return null;
}

/**
 * Merges an incoming realtime message into the local list.
 *
 * Sending is optimistic, so the real row usually arrives after a placeholder is
 * already on screen; it is matched by author and content and replaced in place,
 * which keeps the message from appearing twice or jumping position.
 */
export function mergeIncomingMessage<T extends { id: string; content: string; user_id: string }>(
    existing: T[],
    incoming: T,
): T[] {
    const optimisticIndex = existing.findIndex((m) =>
        m.id.startsWith('temp-')
        && m.content === incoming.content
        && m.user_id === incoming.user_id);

    if (optimisticIndex !== -1) {
        const next = [...existing];
        next[optimisticIndex] = incoming;
        return next;
    }

    if (existing.some((m) => m.id === incoming.id)) return existing;

    return [...existing, incoming];
}
