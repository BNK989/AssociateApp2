import { describe, expect, it } from 'vitest';
import { DEFAULT_HINT_POLICY } from '@/lib/daily/hintPolicy';
import {
    FALLBACK_DAILY_HINT_SETTINGS,
    isMissingTable,
    NO_REVISION,
    settingsFromRow,
} from './settingsRow';

describe('isMissingTable', () => {
    // The window between merging the code and applying the migration is a
    // normal state, not a fault, and has to be distinguishable in the logs.
    it('recognises the raw Postgres undefined-table code', () => {
        expect(isMissingTable({ code: '42P01' })).toBe(true);
    });

    // supabase-js answers through PostgREST, which reports a missing table from
    // its schema cache under its own code. Checking only the SQLSTATE passes a
    // direct SQL test and still logs an error through the client.
    it('recognises the PostgREST schema-cache code', () => {
        expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    });

    it('does not treat other Postgres errors as a missing table', () => {
        expect(isMissingTable({ code: '42501' })).toBe(false);
        expect(isMissingTable({ code: 'PGRST116' })).toBe(false);
    });

    it('ignores a non-string code', () => {
        expect(isMissingTable({ code: 42101 })).toBe(false);
    });

    it('tolerates anything that is not an error object', () => {
        for (const value of [null, undefined, 'boom', 42, [], {}]) {
            expect(isMissingTable(value)).toBe(false);
        }
    });
});

describe('settingsFromRow', () => {
    it('falls back when there is no row', () => {
        expect(settingsFromRow(null)).toEqual(FALLBACK_DAILY_HINT_SETTINGS);
        expect(settingsFromRow(undefined)).toEqual(FALLBACK_DAILY_HINT_SETTINGS);
    });

    it('reads a stored policy', () => {
        const settings = settingsFromRow({
            value: { startLevel: 1, stagger: 'cumulative' },
            scope: 'force',
            revision: 7,
        });

        expect(settings.policy.startLevel).toBe(1);
        expect(settings.policy.stagger).toBe('cumulative');
        expect(settings.scope).toBe('force');
        expect(settings.revision).toBe(7);
    });

    it('treats an empty value as the compiled defaults', () => {
        const settings = settingsFromRow({ value: {}, scope: 'default', revision: 1 });
        expect(settings.policy).toEqual(DEFAULT_HINT_POLICY);
    });

    it('survives a malformed value rather than failing the read', () => {
        const settings = settingsFromRow({ value: 'not a policy', scope: 'default', revision: 3 });

        expect(settings.policy).toEqual(DEFAULT_HINT_POLICY);
        expect(settings.revision).toBe(3);
    });

    // Failing safe matters here: 'force' overrides every player's own
    // preferences, so an unrecognised value must not be able to reach it.
    it('falls back to default scope for anything that is not exactly "force"', () => {
        for (const scope of ['default', 'FORCE', 'forced', '', null]) {
            expect(settingsFromRow({ value: {}, scope, revision: 1 }).scope).toBe('default');
        }
    });

    it('reports no revision when the column is absent or not a number', () => {
        expect(settingsFromRow({ value: {}, scope: 'default', revision: null }).revision)
            .toBe(NO_REVISION);
        expect(settingsFromRow({ value: {}, scope: 'default', revision: NaN }).revision)
            .toBe(NO_REVISION);
    });

    it('keeps a real revision distinguishable from the no-revision marker', () => {
        expect(NO_REVISION).toBe(0);
        expect(settingsFromRow({ value: {}, scope: 'default', revision: 1 }).revision).toBe(1);
    });
});
