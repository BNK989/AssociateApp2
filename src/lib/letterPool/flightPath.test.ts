import { describe, expect, it } from 'vitest';
import { ease, planFlight, type Rect } from './flightPath';

const chip: Rect = { left: 300, top: 120, width: 30, height: 30 };
const slot: Rect = { left: 120, top: 560, width: 24, height: 30 };

describe('ease', () => {
    it('pins both ends', () => {
        expect(ease(0)).toBe(0);
        expect(ease(1)).toBe(1);
    });

    it('never goes backwards', () => {
        let last = -1;
        for (let step = 0; step <= 40; step++) {
            const value = ease(step / 40);
            expect(value).toBeGreaterThanOrEqual(last);
            last = value;
        }
    });

    // The curve is fast off the mark and lands slowly, which is what makes the
    // letter read as docking rather than hitting.
    it('is more than half done by a third of the way through', () => {
        expect(ease(0.33)).toBeGreaterThan(0.5);
        expect(ease(0.9)).toBeGreaterThan(0.97);
    });
});

describe('planFlight', () => {
    const path = planFlight(chip, slot, 9);

    it('starts on the chip and ends on the slot', () => {
        expect(path.left).toBe(chip.left);
        expect(path.top).toBe(chip.top);
        expect(path.x[0]).toBe(0);
        expect(path.y[0]).toBe(0);

        const centreDx = (slot.left + slot.width / 2) - (chip.left + chip.width / 2);
        const centreDy = (slot.top + slot.height / 2) - (chip.top + chip.height / 2);
        expect(path.x[path.x.length - 1]).toBeCloseTo(centreDx, 1);
        expect(path.y[path.y.length - 1]).toBeCloseTo(centreDy, 1);
    });

    it('lands flat, whichever way the chip was leaning', () => {
        expect(planFlight(chip, slot, 12).rotate.at(-1)).toBe(0);
        expect(planFlight(chip, slot, -12).rotate.at(-1)).toBe(0);
    });

    it('shrinks on the way in rather than landing at the chip\'s size', () => {
        expect(path.scale.at(-1)).toBeLessThan(1);
        expect(path.scale.at(-1)).toBeGreaterThan(0.5);
    });

    it('lifts before it travels', () => {
        expect(path.scale[1]).toBeGreaterThan(1);
        expect(path.scaleTimes[1]).toBeLessThan(0.25);
    });

    it('has shed the keycap by the time it arrives', () => {
        expect(path.skin.at(-1)).toBe(0);
    });

    // Picking the perpendicular by the sign of the travel makes a flight to the
    // left and one to the right curve opposite ways, which reads as two
    // different animations. The lob is always upward instead.
    it('lobs upward whichever way it is going', () => {
        for (const target of [slot, { ...slot, left: 700 }]) {
            const sampled = planFlight(chip, target, 0);
            const endX = sampled.x.at(-1)!;
            const endY = sampled.y.at(-1)!;
            const chordLength = endX * endX + endY * endY;

            // Samples sit at *eased* times, so they are not evenly spread along
            // the path — each one has to be projected onto the chord before its
            // offset from the straight line means anything.
            const offsets = sampled.x.map((x, index) => {
                const y = sampled.y[index];
                const along = (x * endX + y * endY) / chordLength;
                return y - along * endY;
            });

            expect(Math.min(...offsets)).toBeLessThan(-8);
            expect(Math.max(...offsets)).toBeLessThan(1);
        }
    });

    it('takes longer the further it goes, within bounds', () => {
        const near = planFlight(chip, { ...chip, top: 180 }, 0).durationMs;
        const far = planFlight(chip, { ...slot, top: 2000 }, 0).durationMs;
        expect(near).toBeLessThan(far);
        expect(near).toBeGreaterThanOrEqual(210);
        expect(far).toBeLessThanOrEqual(430);
    });

    it('does not divide by zero when the ends coincide', () => {
        const still = planFlight(chip, chip, 5);
        expect(still.x.every(Number.isFinite)).toBe(true);
        expect(still.y.every(Number.isFinite)).toBe(true);
    });
});

describe('planFlight — landing at the size the cell will draw', () => {
    // The defect this guards: scaling by the boxes landed the letter at 13px
    // where the cell draws it at 15px, so it popped bigger the instant it
    // arrived — the one thing a docking animation must not do.
    it('arrives at the slot glyph\'s own type size', () => {
        for (const slotWidth of [18, 22, 26]) {
            for (const chipHeight of [24, 31, 36]) {
                const path = planFlight(
                    { left: 0, top: 0, width: chipHeight, height: chipHeight },
                    { left: 200, top: 400, width: slotWidth, height: slotWidth * 1.2 },
                    0,
                );

                const chipFont = chipHeight / 1.85;
                const slotFont = slotWidth * 0.62;
                expect(chipFont * path.scale.at(-1)!).toBeCloseTo(slotFont, 4);
            }
        }
    });

    it('leaves a trace behind that outlives neither the flight nor nothing', () => {
        const path = planFlight(chip, slot, 0);
        expect(path.ghostMs).toBeGreaterThan(0);
        expect(path.ghostMs).toBeLessThan(path.durationMs);
    });
});
