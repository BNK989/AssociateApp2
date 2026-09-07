import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { createLogger } from '@/lib/logger';
import { DEFAULT_HINT_POLICY, parseHintPolicy } from '@/lib/daily/hintPolicy';
import { DEFAULT_FEEDBACK_POLICY, parseFeedbackPolicy } from '@/lib/daily/feedbackPolicy';
import {
    DAILY_FEEDBACK_KEY,
    DAILY_HINT_POLICY_KEY,
    getDailyFeedbackSettings,
    getDailyHintSettings,
} from '@/lib/gameSettings/server';
import { writeSetting } from '@/lib/gameSettings/writeSetting';

export const dynamic = 'force-dynamic';

const log = createLogger('api/admin/game-settings');

/**
 * The settings keys this route will write, and how each one is normalised.
 *
 * A registry rather than a second route per key: the revision counter, the
 * audit entry and the cache expiry are identical for every key and are exactly
 * the parts that must not be reimplemented. What differs is the parser, so that
 * is the only thing a key contributes.
 *
 * `hasScope` marks the keys where `default` and `force` mean something. Reward
 * feedback has no scope — a player's mute always wins, so there is nothing for
 * `force` to express — and a scope sent for it is rejected rather than stored
 * as a setting that would silently do nothing.
 */
const KEYS = {
    [DAILY_HINT_POLICY_KEY]: {
        parse: parseHintPolicy,
        codeDefault: DEFAULT_HINT_POLICY,
        hasScope: true,
    },
    [DAILY_FEEDBACK_KEY]: {
        parse: parseFeedbackPolicy,
        codeDefault: DEFAULT_FEEDBACK_POLICY,
        hasScope: false,
    },
} as const;

type SettingsKey = keyof typeof KEYS;

function isSettingsKey(value: unknown): value is SettingsKey {
    return typeof value === 'string' && value in KEYS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads both settings keys for the admin panel.
 *
 * Returns the compiled defaults alongside each stored value so the panel can
 * show, per field, what the code would do if the setting were cleared — which
 * is what makes "reset to default" meaningful rather than a guess.
 */
export async function GET() {
    const auth = await requireAdmin();

    if (!auth.ok) {
        log.warn('auth', 'Rejected a read of the game settings', { reason: auth.reason });
        return NextResponse.json({ error: auth.reason }, { status: auth.status });
    }

    const [hints, feedback] = await Promise.all([
        getDailyHintSettings(),
        getDailyFeedbackSettings(),
    ]);

    return NextResponse.json({
        key: DAILY_HINT_POLICY_KEY,
        policy: hints.policy,
        scope: hints.scope,
        revision: hints.revision,
        codeDefault: DEFAULT_HINT_POLICY,
        feedback: {
            key: DAILY_FEEDBACK_KEY,
            policy: feedback.policy,
            revision: feedback.revision,
            codeDefault: DEFAULT_FEEDBACK_POLICY,
        },
    });
}

/**
 * Saves one settings key.
 *
 * `key` is optional and defaults to the hint policy, so the shape this route
 * answered before reward feedback existed still works unchanged.
 *
 * The submitted policy is normalised through the key's parser and the stored
 * result is echoed back, so the panel always shows what was actually written
 * rather than what it hoped to write.
 */
export async function PUT(request: Request) {
    const auth = await requireAdmin();

    if (!auth.ok) {
        log.warn('auth', 'Rejected a write to the game settings', { reason: auth.reason });
        return NextResponse.json({ error: auth.reason }, { status: auth.status });
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch (e) {
        log.warn('parse', 'Settings write rejected: body was not valid JSON', { user_id: auth.userId }, e);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!isRecord(body)) {
        return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
    }

    const key = body.key === undefined ? DAILY_HINT_POLICY_KEY : body.key;

    if (!isSettingsKey(key)) {
        log.warn('validate', 'Settings write rejected: unknown key', {
            user_id: auth.userId,
            received: String(key),
        });
        return NextResponse.json({ error: `Unknown settings key: ${String(key)}` }, { status: 400 });
    }

    const entry = KEYS[key];

    // Scope is rejected rather than normalised. Silently coercing it would flip
    // whether the policy binds every player or only new ones, which is too
    // consequential to guess at on the player's behalf.
    if (entry.hasScope && body.scope !== 'default' && body.scope !== 'force') {
        log.warn('validate', 'Settings write rejected: scope must be "default" or "force"', {
            user_id: auth.userId,
            key,
            received: String(body.scope),
        });
        return NextResponse.json({ error: 'scope must be "default" or "force"' }, { status: 400 });
    }

    const scope = entry.hasScope ? (body.scope as 'default' | 'force') : 'default';
    const policy = entry.parse(body.policy);

    const result = await writeSetting({ key, value: policy, scope, userId: auth.userId });

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    log.info('write', 'Game setting saved', {
        user_id: auth.userId,
        key,
        revision: result.revision,
        scope,
    });

    return NextResponse.json({ key, policy, scope, revision: result.revision });
}
