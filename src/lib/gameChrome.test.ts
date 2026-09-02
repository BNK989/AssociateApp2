import { describe, expect, it } from 'vitest';
import { isImmersiveGameRoute } from './gameChrome';

describe('isImmersiveGameRoute', () => {
    it('hides chrome on a multiplayer game route', () => {
        expect(isImmersiveGameRoute('/game/abc-123')).toBe(true);
    });

    it('hides chrome on the daily route', () => {
        expect(isImmersiveGameRoute('/daily')).toBe(true);
    });

    it('keeps chrome on the lobby and content pages', () => {
        expect(isImmersiveGameRoute('/')).toBe(false);
        expect(isImmersiveGameRoute('/privacy')).toBe(false);
        expect(isImmersiveGameRoute('/join/abc-123')).toBe(false);
    });

    it('keeps chrome when there is no pathname yet', () => {
        expect(isImmersiveGameRoute(null)).toBe(false);
        expect(isImmersiveGameRoute(undefined)).toBe(false);
        expect(isImmersiveGameRoute('')).toBe(false);
    });

    it('is documented as locale-stripped: a prefixed path does not match', () => {
        // Guards the contract rather than the behaviour — callers must use
        // `usePathname` from `@/navigation`, which strips the prefix.
        expect(isImmersiveGameRoute('/he/daily')).toBe(false);
    });
});
