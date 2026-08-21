import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    createLogger,
    formatEntry,
    normalizeError,
    setDebugMode,
    isDebugEnabled,
    setLogSink,
    DEBUG_STORAGE_KEY,
    type LogEntry,
} from './logger';

let captured: LogEntry[] = [];
let lines: string[] = [];

beforeEach(() => {
    captured = [];
    lines = [];
    setLogSink((entry, line) => {
        captured.push(entry);
        lines.push(line);
    });
    setDebugMode(null);
    window.localStorage.removeItem(DEBUG_STORAGE_KEY);
});

afterEach(() => {
    setLogSink(null);
    setDebugMode(null);
});

describe('normalizeError', () => {
    it('returns undefined for absent errors', () => {
        expect(normalizeError(null)).toBeUndefined();
        expect(normalizeError(undefined)).toBeUndefined();
    });

    it('normalizes native Errors', () => {
        const result = normalizeError(new TypeError('bad input'));
        expect(result?.name).toBe('TypeError');
        expect(result?.message).toBe('bad input');
        expect(result?.stack).toBeDefined();
    });

    it('normalizes Supabase/PostgREST error objects', () => {
        const result = normalizeError({
            message: 'no rows returned',
            code: 'PGRST116',
            details: 'Results contain 0 rows',
            hint: 'Use maybeSingle()',
        });

        expect(result).toMatchObject({
            name: 'SupabaseError',
            message: 'no rows returned',
            code: 'PGRST116',
            details: 'Results contain 0 rows',
            hint: 'Use maybeSingle()',
        });
    });

    it('normalizes thrown strings and unknown shapes', () => {
        expect(normalizeError('boom')).toMatchObject({ name: 'Error', message: 'boom' });
        expect(normalizeError(42)).toMatchObject({ name: 'UnknownError', message: '42' });
    });

    it('survives circular structures', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => normalizeError(circular)).not.toThrow();
    });
});

describe('formatEntry', () => {
    it('produces a single copy-pasteable line with scope, operation and identifiers', () => {
        const line = formatEntry({
            timestamp: '2026-08-21T09:00:00.000Z',
            level: 'warn',
            scope: 'daily/generate',
            operation: 'generate_chain',
            message: 'Gemini returned malformed chain, falling back to curated pool',
            context: { play_date: '2026-08-21', locale: 'he' },
        });

        expect(line).toBe(
            '[2026-08-21T09:00:00.000Z] WARN [daily/generate] generate_chain: ' +
            'Gemini returned malformed chain, falling back to curated pool | play_date=2026-08-21 locale=he',
        );
        expect(line.split('\n')).toHaveLength(1);
    });

    it('appends normalized error detail', () => {
        const line = formatEntry({
            timestamp: '2026-08-21T09:00:00.000Z',
            level: 'error',
            scope: 'game/action',
            operation: 'solve_message',
            message: 'Update rejected',
            error: { name: 'SupabaseError', message: 'permission denied', code: '42501', hint: 'check RLS' },
        });

        expect(line).toContain('SupabaseError(42501): permission denied');
        expect(line).toContain('hint: check RLS');
    });

    it('omits undefined context values but keeps explicit nulls', () => {
        const line = formatEntry({
            timestamp: '2026-08-21T09:00:00.000Z',
            level: 'info',
            scope: 'auth',
            operation: 'sign_in',
            message: 'ok',
            context: { user_id: null, game_id: undefined, attempt: 2 },
        });

        expect(line).toContain('user_id=null');
        expect(line).toContain('attempt=2');
        expect(line).not.toContain('game_id');
    });
});

describe('level gating', () => {
    it('always emits warn and error regardless of debug mode', () => {
        setDebugMode(false);
        const log = createLogger('game');

        log.warn('rotate_turn', 'turn rotation skipped');
        log.error('rotate_turn', 'turn rotation failed');

        expect(captured.map((e) => e.level)).toEqual(['warn', 'error']);
    });

    it('suppresses debug and info when debug mode is off', () => {
        setDebugMode(false);
        const log = createLogger('game');

        log.debug('tick', 'timer tick');
        log.info('join', 'player joined');

        expect(captured).toHaveLength(0);
    });

    it('emits debug and info when debug mode is on', () => {
        setDebugMode(true);
        const log = createLogger('game');

        log.debug('tick', 'timer tick');
        log.info('join', 'player joined');

        expect(captured.map((e) => e.level)).toEqual(['debug', 'info']);
    });
});

describe('debug mode resolution', () => {
    it('persists the override to localStorage', () => {
        setDebugMode(true);
        expect(window.localStorage.getItem(DEBUG_STORAGE_KEY)).toBe('1');

        setDebugMode(false);
        expect(window.localStorage.getItem(DEBUG_STORAGE_KEY)).toBe('0');
    });

    it('clears the stored flag when reset to null', () => {
        setDebugMode(true);
        setDebugMode(null);
        expect(window.localStorage.getItem(DEBUG_STORAGE_KEY)).toBeNull();
    });

    it('reads a previously stored flag when there is no in-memory override', () => {
        window.localStorage.setItem(DEBUG_STORAGE_KEY, '1');
        setDebugMode(null);
        expect(isDebugEnabled()).toBe(true);

        window.localStorage.setItem(DEBUG_STORAGE_KEY, '0');
        expect(isDebugEnabled()).toBe(false);
    });
});

describe('createLogger', () => {
    it('stamps scope and operation onto every entry', () => {
        setDebugMode(true);
        createLogger('daily/generate').info('load_game', 'loaded', { play_date: '2026-08-21' });

        expect(captured[0]).toMatchObject({
            scope: 'daily/generate',
            operation: 'load_game',
            message: 'loaded',
            context: { play_date: '2026-08-21' },
        });
    });

    it('nests scopes via child()', () => {
        setDebugMode(true);
        createLogger('daily').child('generate').child('gemini').debug('call', 'requesting');

        expect(captured[0].scope).toBe('daily/generate/gemini');
    });

    it('attaches the original error to failures', () => {
        const log = createLogger('daily');
        log.error('persist', 'insert failed', { play_date: '2026-08-21' }, { message: 'duplicate key', code: '23505' });

        expect(captured[0].error).toMatchObject({ message: 'duplicate key', code: '23505' });
        expect(lines[0]).toContain('play_date=2026-08-21');
    });

    it('never writes to the DOM', () => {
        setLogSink(null);
        setDebugMode(true);
        const before = document.body.innerHTML;

        createLogger('game').error('boom', 'exploded', undefined, new Error('nope'));

        expect(document.body.innerHTML).toBe(before);
    });
});
