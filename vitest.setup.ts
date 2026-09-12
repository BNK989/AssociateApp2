/**
 * Browser APIs jsdom does not implement.
 *
 * These are not behaviour under test -- nothing here has an assertion pointed
 * at it. They exist because a component that measures itself (the walkthrough
 * card) or scrolls its subject into view would otherwise crash on mount in a
 * test environment, which tells us nothing about the component.
 *
 * Each is installed only when missing, so a future jsdom that ships the real
 * thing wins over the stub.
 */

if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() { };
}
