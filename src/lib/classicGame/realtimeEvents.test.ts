import { describe, it, expect } from 'vitest';
import {
    getPointsToShow,
    getStealAnimation,
    isStealEvent,
    mergeIncomingMessage,
} from './realtimeEvents';

const ME = 'user-me';
const AUTHOR = 'user-author';
const THIEF = 'user-thief';

const solved = (over: Record<string, unknown> = {}) => ({
    id: 'msg-1',
    user_id: AUTHOR,
    solved_by: THIEF,
    winner_points: 40,
    author_points: 10,
    ...over,
});

const players = [
    { user_id: ME, profiles: { username: 'Me', avatar_url: '/me.png' } },
    { user_id: AUTHOR, profiles: { username: 'Ann', avatar_url: '/ann.png' } },
    { user_id: THIEF, profiles: { username: 'Tom', avatar_url: '/tom.png' } },
];

describe('isStealEvent', () => {
    it('is true when someone else solved the word for points', () => {
        expect(isStealEvent(solved())).toBe(true);
    });

    it('is false when the author solved their own word', () => {
        expect(isStealEvent(solved({ solved_by: AUTHOR }))).toBe(false);
    });

    it('is false for a zero-point solve, which is a give-up or a third strike', () => {
        expect(isStealEvent(solved({ winner_points: 0 }))).toBe(false);
        expect(isStealEvent(solved({ winner_points: undefined }))).toBe(false);
    });

    it('is false when nobody solved it', () => {
        expect(isStealEvent(solved({ solved_by: undefined }))).toBe(false);
    });
});

describe('getStealAnimation', () => {
    it('names both players for an onlooker', () => {
        expect(getStealAnimation(solved(), ME, players)).toEqual({
            stealerName: 'Tom',
            stealerAvatar: '/tom.png',
            authorName: 'Ann',
        });
    });

    it('says "You" to the thief', () => {
        expect(getStealAnimation(solved(), THIEF, players).stealerName).toBe('You');
    });

    it('says "You" to the robbed author', () => {
        expect(getStealAnimation(solved(), AUTHOR, players).authorName).toBe('You');
    });

    it('falls back when the solver is not in the local roster yet', () => {
        expect(getStealAnimation(solved({ solved_by: 'stranger' }), ME, players)).toEqual({
            stealerName: 'Thief',
            stealerAvatar: '',
            authorName: 'Someone',
        });
    });

    it('falls back on the author name alone when only they are unknown', () => {
        const result = getStealAnimation(solved({ user_id: 'ghost' }), ME, players);
        expect(result.stealerName).toBe('Tom');
        expect(result.authorName).toBe('Unknown');
    });
});

describe('getPointsToShow', () => {
    it('shows the solver what they won', () => {
        expect(getPointsToShow(solved(), THIEF)).toBe(40);
    });

    it('shows the robbed author their consolation share', () => {
        expect(getPointsToShow(solved(), AUTHOR)).toBe(10);
    });

    it('shows an uninvolved player nothing', () => {
        expect(getPointsToShow(solved(), ME)).toBeNull();
    });

    it('shows nothing when the share is zero', () => {
        expect(getPointsToShow(solved({ author_points: 0 }), AUTHOR)).toBeNull();
        expect(getPointsToShow(solved({ winner_points: 0 }), THIEF)).toBeNull();
    });

    it('prefers the solver share when author and solver are the same player', () => {
        const own = solved({ solved_by: AUTHOR, winner_points: 25, author_points: 99 });
        expect(getPointsToShow(own, AUTHOR)).toBe(25);
    });
});

describe('mergeIncomingMessage', () => {
    const real = { id: 'real-1', content: 'Coffee', user_id: ME };

    it('replaces a matching optimistic placeholder in place', () => {
        const existing = [
            { id: 'other', content: 'Tea', user_id: AUTHOR },
            { id: 'temp-123', content: 'Coffee', user_id: ME },
        ];
        const merged = mergeIncomingMessage(existing, real);

        expect(merged).toHaveLength(2);
        expect(merged[1].id).toBe('real-1');
    });

    it('keeps the placeholder position rather than appending', () => {
        const existing = [
            { id: 'temp-123', content: 'Coffee', user_id: ME },
            { id: 'other', content: 'Tea', user_id: AUTHOR },
        ];
        expect(mergeIncomingMessage(existing, real)[0].id).toBe('real-1');
    });

    it('does not match a placeholder from a different author', () => {
        const existing = [{ id: 'temp-1', content: 'Coffee', user_id: AUTHOR }];
        expect(mergeIncomingMessage(existing, real)).toHaveLength(2);
    });

    it('appends a message from someone else', () => {
        const existing = [{ id: 'other', content: 'Tea', user_id: AUTHOR }];
        expect(mergeIncomingMessage(existing, real)).toHaveLength(2);
    });

    it('ignores a duplicate that already arrived', () => {
        const existing = [real];
        expect(mergeIncomingMessage(existing, real)).toBe(existing);
    });

    it('appends into an empty list', () => {
        expect(mergeIncomingMessage([], real)).toEqual([real]);
    });
});
