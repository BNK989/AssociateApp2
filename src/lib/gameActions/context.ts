import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Everything an action handler needs: an authenticated Supabase client scoped
 * to the caller's cookies, the game being acted on, and who is acting.
 */
export type ActionContext = {
    supabase: SupabaseClient;
    gameId: string;
    user: User;
    request: Request;
};

/**
 * A handler returns a Response only when it needs to say something specific —
 * a validation failure, or a payload for the client. Returning nothing means
 * the route replies with the default `{ success: true }`.
 */
export type ActionHandler = (
    ctx: ActionContext,
    payload: ActionPayload,
) => Promise<Response | void>;

/**
 * Action payloads are client-supplied JSON. Handlers read the fields they need
 * and are responsible for validating them.
 */
export type ActionPayload = Record<string, unknown>;

export function readString(payload: ActionPayload, key: string): string | undefined {
    const value = payload[key];
    return typeof value === 'string' ? value : undefined;
}

export function readNumber(payload: ActionPayload, key: string): number | undefined {
    const value = payload[key];
    return typeof value === 'number' ? value : undefined;
}

export function readBoolean(payload: ActionPayload, key: string): boolean {
    return payload[key] === true;
}
