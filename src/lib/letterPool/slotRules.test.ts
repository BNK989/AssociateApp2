import { describe, expect, it } from 'vitest';
import { typeableCapacity } from './slotRules';

describe('typeableCapacity', () => {
    it('counts every slot the player could type into', () => {
        expect(typeableCapacity('Harmony')).toBe(7);
    });

    it('leaves out the scenery the strip supplies', () => {
        expect(typeableCapacity('morning glory')).toBe(12);
        expect(typeableCapacity("o'clock")).toBe(6);
    });
});
