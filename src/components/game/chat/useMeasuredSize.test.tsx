import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMeasuredSize } from './useMeasuredSize';

type Observe = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

/** A ResizeObserver the test can fire by hand. */
function installResizeObserver() {
    const callbacks: Observe[] = [];
    const observed: Element[] = [];
    const disconnected = { count: 0 };

    class FakeResizeObserver {
        constructor(callback: Observe) {
            callbacks.push(callback);
        }
        observe(element: Element) {
            observed.push(element);
        }
        unobserve() { }
        disconnect() {
            disconnected.count += 1;
        }
    }

    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    return {
        observed,
        disconnected,
        fire: () => callbacks.forEach((callback) => callback([], {} as ResizeObserver)),
    };
}

/** jsdom has no layout engine, so the rectangle is whatever the test says. */
function layOut(width: number, height: number) {
    return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width,
        height,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        toJSON: () => ({}),
    } as DOMRect);
}

function Probe() {
    const { ref, width, height } = useMeasuredSize<HTMLDivElement>();
    return <div ref={ref} data-testid="box">{`${width ?? 'auto'} x ${height ?? 'auto'}`}</div>;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('useMeasuredSize', () => {
    it('reads both sides once the element is on the page', () => {
        installResizeObserver();
        layOut(240, 32);

        render(<Probe />);

        expect(screen.getByTestId('box').textContent).toBe('240 x 32');
    });

    it('treats an element with no layout as unmeasured, not as zero', () => {
        // Zero would animate a box shut; `auto` leaves it open at its natural size.
        installResizeObserver();
        layOut(0, 0);

        render(<Probe />);

        expect(screen.getByTestId('box').textContent).toBe('auto x auto');
    });

    it('follows the element as its content changes size', () => {
        const observer = installResizeObserver();
        const rect = layOut(240, 32);

        render(<Probe />);
        expect(observer.observed).toEqual([screen.getByTestId('box')]);

        rect.mockReturnValue({
            width: 320, height: 96, x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 96, toJSON: () => ({}),
        } as DOMRect);
        act(() => observer.fire());

        expect(screen.getByTestId('box').textContent).toBe('320 x 96');
    });

    it('stops watching when the element goes away', () => {
        const observer = installResizeObserver();
        layOut(1, 1);

        const view = render(<Probe />);
        view.unmount();

        expect(observer.disconnected.count).toBe(1);
    });
});
