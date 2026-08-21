import { describe, it, expect } from 'vitest';
import { ACTION_HANDLERS } from './index';

/**
 * The actions the client is known to send. Kept as a literal rather than
 * derived from ACTION_HANDLERS so the two have to be changed together — a
 * handler dropped by accident fails here instead of at runtime.
 *
 * Regenerate with:
 *   grep -rhoE "action: '[a-z_]+'" src
 */
const CLIENT_ACTIONS = [
    'confirm_solve',
    'deny_solve',
    'get_hint',
    'give_up',
    'leave_game',
    'propose_solve',
    'reset_game',
    'solve_attempt',
];

describe('ACTION_HANDLERS', () => {
    it('covers every action the client sends', () => {
        const missing = CLIENT_ACTIONS.filter((a) => !(a in ACTION_HANDLERS));
        expect(missing).toEqual([]);
    });

    it('exposes no handler the client never calls', () => {
        const extra = Object.keys(ACTION_HANDLERS).filter((a) => !CLIENT_ACTIONS.includes(a));
        expect(extra).toEqual([]);
    });

    it('maps every action to a callable handler', () => {
        for (const [action, handler] of Object.entries(ACTION_HANDLERS)) {
            expect(typeof handler, `${action} handler`).toBe('function');
        }
    });

    it('does not resolve an unknown action', () => {
        expect(ACTION_HANDLERS['not_a_real_action']).toBeUndefined();
        expect(ACTION_HANDLERS['']).toBeUndefined();
        // The admin hint path posts `type` rather than `action`, so `action` is
        // undefined; that must miss the table rather than match something.
        expect(ACTION_HANDLERS[undefined as unknown as string]).toBeUndefined();
    });
});
