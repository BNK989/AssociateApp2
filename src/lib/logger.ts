/**
 * Central logger for AssociateApp2.
 *
 * Contract (see CLAUDE.md §8):
 * - Every log line carries a SCOPE, an OPERATION, human-readable IDENTIFIERS,
 *   and — for failures — the ORIGINAL error, normalized.
 * - Output is a single copy-pasteable line so the human QA can relay it verbatim.
 *
 * INVISIBLE TO PLAYERS. This module writes to the console only. It must never
 * render to the DOM, raise a toast, or otherwise surface in the player UI.
 * `debug` / `info` are suppressed entirely unless debug mode is on; `warn` /
 * `error` always emit, because devtools output is not player-facing.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Identifiers attached to a log line: game id, user id, locale, play date... */
export type LogContext = Record<string, string | number | boolean | null | undefined>;

export interface NormalizedError {
    name: string;
    message: string;
    /** Postgres / PostgREST error code, when the failure came from Supabase. */
    code?: string;
    details?: string;
    hint?: string;
    stack?: string;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    scope: string;
    operation: string;
    message: string;
    context?: LogContext;
    error?: NormalizedError;
}

export type LogSink = (entry: LogEntry, line: string) => void;

const LEVEL_RANK: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

export const DEBUG_STORAGE_KEY = 'associate:debug';

// --------------------------------------------------------------------------
// Debug mode
// --------------------------------------------------------------------------

let debugOverride: boolean | null = null;

/**
 * Force debug mode on/off. Pass `null` to fall back to stored/environment
 * defaults. Called by the admin-only toggle in Settings.
 */
export function setDebugMode(enabled: boolean | null): void {
    debugOverride = enabled;

    if (typeof window === 'undefined') return;

    try {
        if (enabled === null) {
            window.localStorage.removeItem(DEBUG_STORAGE_KEY);
        } else {
            window.localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? '1' : '0');
        }
    } catch {
        // Private browsing or storage disabled. In-memory override still applies.
    }
}

export function isDebugEnabled(): boolean {
    if (debugOverride !== null) return debugOverride;

    if (typeof window !== 'undefined') {
        try {
            const stored = window.localStorage.getItem(DEBUG_STORAGE_KEY);
            if (stored !== null) return stored === '1';
        } catch {
            // Fall through to the environment default.
        }
    }

    return process.env.NODE_ENV !== 'production';
}

// --------------------------------------------------------------------------
// Error normalization
// --------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Coerce anything thrown into a predictable shape. Understands native Errors
 * and Supabase/PostgREST error objects (`code` / `details` / `hint`), which are
 * plain objects rather than Error instances.
 */
export function normalizeError(error: unknown): NormalizedError | undefined {
    if (error === null || error === undefined) return undefined;

    if (error instanceof Error) {
        const extra = asRecord(error) ?? {};
        return {
            name: error.name,
            message: error.message,
            code: readString(extra, 'code'),
            details: readString(extra, 'details'),
            hint: readString(extra, 'hint'),
            stack: error.stack,
        };
    }

    if (typeof error === 'string') {
        return { name: 'Error', message: error };
    }

    const record = asRecord(error);
    if (record) {
        const message = readString(record, 'message');
        if (message) {
            return {
                name: readString(record, 'name') ?? 'SupabaseError',
                message,
                code: readString(record, 'code'),
                details: readString(record, 'details'),
                hint: readString(record, 'hint'),
            };
        }
    }

    return { name: 'UnknownError', message: safeStringify(error) };
}

/**
 * Best-effort human-readable message from an unknown thrown value. Use in
 * `catch (error: unknown)` blocks instead of widening the binding to `any`.
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
    return normalizeError(error)?.message ?? fallback;
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------

function formatContext(context?: LogContext): string {
    if (!context) return '';

    const pairs = Object.entries(context)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value === null ? 'null' : String(value)}`);

    return pairs.length > 0 ? ` | ${pairs.join(' ')}` : '';
}

function formatError(error?: NormalizedError): string {
    if (!error) return '';

    const label = error.code ? `${error.name}(${error.code})` : error.name;
    const parts = [`${label}: ${error.message}`];

    if (error.details) parts.push(`details: ${error.details}`);
    if (error.hint) parts.push(`hint: ${error.hint}`);

    return ` | ${parts.join(' — ')}`;
}

/** Renders an entry as the single line the human copies back to the agent. */
export function formatEntry(entry: LogEntry): string {
    const head = `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.scope}] ${entry.operation}:`;
    return `${head} ${entry.message}${formatContext(entry.context)}${formatError(entry.error)}`;
}

// --------------------------------------------------------------------------
// Transport
// --------------------------------------------------------------------------

let sink: LogSink | null = null;

/** Swap the transport. Used by tests; production leaves this at the console. */
export function setLogSink(next: LogSink | null): void {
    sink = next;
}

function consoleSink(entry: LogEntry, line: string): void {
    if (entry.level === 'error') {
        console.error(line);
    } else if (entry.level === 'warn') {
        console.warn(line);
    } else {
        console.log(line);
    }

    // Stacks are noisy; only surface them when the human is actively debugging.
    if (entry.error?.stack && isDebugEnabled()) {
        console.error(entry.error.stack);
    }
}

function shouldEmit(level: LogLevel): boolean {
    if (LEVEL_RANK[level] >= LEVEL_RANK.warn) return true;
    return isDebugEnabled();
}

function emit(
    level: LogLevel,
    scope: string,
    operation: string,
    message: string,
    context?: LogContext,
    error?: unknown,
): void {
    if (!shouldEmit(level)) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        scope,
        operation,
        message,
        context,
        error: normalizeError(error),
    };

    (sink ?? consoleSink)(entry, formatEntry(entry));
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export interface Logger {
    debug(operation: string, message: string, context?: LogContext): void;
    info(operation: string, message: string, context?: LogContext): void;
    warn(operation: string, message: string, context?: LogContext, error?: unknown): void;
    error(operation: string, message: string, context?: LogContext, error?: unknown): void;
    /** Narrows the scope, e.g. createLogger('daily').child('generate'). */
    child(subScope: string): Logger;
}

/**
 * Create a scoped logger. Scope names a module or feature and appears in every
 * line, e.g. `daily/generate`, `game/action`, `auth/callback`.
 */
export function createLogger(scope: string): Logger {
    return {
        debug: (operation, message, context) => emit('debug', scope, operation, message, context),
        info: (operation, message, context) => emit('info', scope, operation, message, context),
        warn: (operation, message, context, error) =>
            emit('warn', scope, operation, message, context, error),
        error: (operation, message, context, error) =>
            emit('error', scope, operation, message, context, error),
        child: (subScope) => createLogger(`${scope}/${subScope}`),
    };
}
