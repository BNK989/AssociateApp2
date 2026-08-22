import { describe, expect, it } from 'vitest';
import { isMissingColumn, isMissingTable } from './supabaseErrors';

describe('isMissingTable', () => {
    it('recognises the raw Postgres SQLSTATE', () => {
        expect(isMissingTable({ code: '42P01' })).toBe(true);
    });

    // supabase-js answers through PostgREST, which reports a missing table from
    // its schema cache under its own code. Checking only the SQLSTATE passes a
    // direct SQL test and still fails through the client.
    it('recognises the PostgREST schema-cache code', () => {
        expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    });

    it('does not confuse a missing column for a missing table', () => {
        expect(isMissingTable({ code: '42703' })).toBe(false);
        expect(isMissingTable({ code: 'PGRST204' })).toBe(false);
    });
});

describe('isMissingColumn', () => {
    it('recognises both codes', () => {
        expect(isMissingColumn({ code: '42703' })).toBe(true);
        expect(isMissingColumn({ code: 'PGRST204' })).toBe(true);
    });

    it('does not confuse a missing table for a missing column', () => {
        expect(isMissingColumn({ code: '42P01' })).toBe(false);
        expect(isMissingColumn({ code: 'PGRST205' })).toBe(false);
    });
});

describe('both predicates', () => {
    it('reject unrelated database errors', () => {
        for (const code of ['42501', 'PGRST116', '23505']) {
            expect(isMissingTable({ code })).toBe(false);
            expect(isMissingColumn({ code })).toBe(false);
        }
    });

    it('tolerate anything that is not an error object', () => {
        for (const value of [null, undefined, 'boom', 42, [], {}, { code: 42703 }]) {
            expect(isMissingTable(value)).toBe(false);
            expect(isMissingColumn(value)).toBe(false);
        }
    });
});
