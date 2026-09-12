'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { planFlight, type FlightPath, type Rect } from '@/lib/letterPool/flightPath';
import type { HaloPlacement } from '@/lib/letterPool/haloLayout';

/** One letter in the air, either on its way to a slot or on its way home. */
export interface Flight {
    /** Unique per flight, so a letter placed twice animates twice. */
    key: string;
    poolId: string;
    char: string;
    homeward: boolean;
    path: FlightPath;
}

type Args = {
    /** Pool ids currently sitting in a slot. */
    placed: Set<string>;
    /** Pool id to the slot index it filled. */
    placements: Map<string, number>;
    /** The halo as solved: the character to fly, and the angle to unwind. */
    letters: HaloPlacement[];
    /** No flights at all: the letter simply appears where it landed. */
    reduced: boolean;
};

/**
 * Letters in flight between the halo and the composer's strip.
 *
 * The whole job is timing. A placement is one state change that has to be told
 * in two places at once — the chip leaves the halo, the letter appears in the
 * strip — and if either end acts on its own the player sees the same letter
 * twice, or sees it vanish and reappear somewhere else.
 *
 * So this hook owns the moment. It watches `placed`, measures both ends in a
 * single layout pass, and reports back which letters are mid-flight; the halo
 * hides those chips and the strip holds those glyphs back until the flight
 * lands. Nothing here animates anything: it produces paths, and framer runs
 * them in a fixed overlay where no scroll container can distort the geometry.
 *
 * **Chips are hidden rather than unmounted when placed.** That is what makes
 * the measurement possible at all — this runs after the commit that placed the
 * letter, and an unmounted chip has no rectangle to read. It also means a
 * letter's home is still there for it to fly back to on a backspace.
 */
export function useLetterFlights({ placed, placements, letters, reduced }: Args) {
    // Read inside the layout effect below, which must not re-run when the halo
    // is re-solved — only when a letter actually moves.
    const halo = useRef(letters);
    halo.current = letters;
    const [flights, setFlights] = useState<Flight[]>([]);
    const previous = useRef<{ placed: Set<string>; placements: Map<string, number> }>({
        placed: new Set(),
        placements: new Map(),
    });
    const sequence = useRef(0);

    useLayoutEffect(() => {
        const was = previous.current;
        previous.current = { placed: new Set(placed), placements: new Map(placements) };

        if (reduced) return;

        const launched: Flight[] = [];

        for (const poolId of placed) {
            if (was.placed.has(poolId)) continue;
            const slotIndex = placements.get(poolId);
            if (slotIndex === undefined) continue;

            const letter = halo.current.find((spot) => spot.id === poolId);
            const path = measure(chipOf(poolId), cellOf(slotIndex), letter?.tilt ?? 0);
            if (path) {
                launched.push({
                    key: `${poolId}-${sequence.current++}`,
                    poolId,
                    char: letter?.char ?? '',
                    homeward: false,
                    path,
                });
            }
        }

        // Backspace. The letter goes back to the spot it came from, which is
        // still there because the chip was only ever hidden.
        for (const poolId of was.placed) {
            if (placed.has(poolId)) continue;
            const slotIndex = was.placements.get(poolId);
            if (slotIndex === undefined) continue;

            const letter = halo.current.find((spot) => spot.id === poolId);
            const path = measure(cellOf(slotIndex), chipOf(poolId), 0);
            if (path) {
                launched.push({
                    key: `${poolId}-${sequence.current++}`,
                    poolId,
                    char: letter?.char ?? '',
                    homeward: true,
                    path,
                });
            }
        }

        if (launched.length > 0) setFlights((current) => [...current, ...launched]);
        // The halo is re-solved every render and read through a ref above; the
        // placement sets are what actually decide whether anything moved.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placed, placements, reduced]);

    const land = useCallback((key: string) => {
        setFlights((current) => current.filter((flight) => flight.key !== key));
    }, []);

    /**
     * A scroll mid-flight leaves the origin behind: the path was measured in
     * viewport coordinates against a list that has since moved. Rather than
     * play out a flight that now starts from the wrong place, land them all at
     * once — the letter is where it should be either way.
     */
    useEffect(() => {
        if (flights.length === 0) return;

        const landAll = () => setFlights([]);
        window.addEventListener('scroll', landAll, { capture: true, passive: true });
        return () => window.removeEventListener('scroll', landAll, { capture: true });
    }, [flights.length]);

    const inFlight = new Set(flights.map((flight) => flight.poolId));

    return {
        flights,
        land,
        /** Chips the halo must keep hidden: placed, or still flying home. */
        hidden: new Set([...placed, ...flights.filter((f) => f.homeward).map((f) => f.poolId)]),
        /** Glyphs the strip must hold back until their letter lands. */
        held: new Set(flights.filter((flight) => !flight.homeward).map((flight) => flight.poolId)),
        inFlight,
    };
}

const chipOf = (poolId: string) => document.getElementById(`halo-${poolId}`);
const cellOf = (slotIndex: number) =>
    document.querySelector<HTMLElement>(`[data-slot-index="${slotIndex}"]`);

/**
 * Both ends, read together.
 *
 * One layout pass for the pair, on the typing path, before anything is written
 * back — so a keystroke costs a single forced reflow rather than one per end.
 */
function measure(from: Element | null, to: Element | null, tilt: number): FlightPath | null {
    if (!from || !to) return null;

    const a = box(from);
    const b = box(to);
    if (a.width === 0 || b.width === 0) return null;

    return planFlight(a, b, tilt);
}

function box(element: Element): Rect {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}
