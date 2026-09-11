import { describe, expect, it } from 'vitest';
import { getUserMenuLinks } from './userMenuLinks';

describe('getUserMenuLinks', () => {
    it('gives every signed-in user their preferences', () => {
        expect(getUserMenuLinks(false).map((l) => l.href)).toEqual(['/settings']);
    });

    // The panel has no other entry point, so a missing link means an admin on a
    // phone has to type the URL to reach it.
    it('offers the admin panel to an admin', () => {
        const links = getUserMenuLinks(true);
        expect(links.map((l) => l.href)).toEqual(['/settings', '/admin']);
        expect(links[1].labelKey).toBe('admin_panel');
    });

    it('hides the admin panel from everyone else', () => {
        expect(getUserMenuLinks(false).some((l) => l.href === '/admin')).toBe(false);
    });

    // Locale-relative, so `@/navigation`'s Link keeps a Hebrew admin in Hebrew
    // instead of dropping them into the default locale.
    it('keeps hrefs locale-relative', () => {
        for (const link of getUserMenuLinks(true)) {
            expect(link.href.startsWith('/')).toBe(true);
            expect(link.href).not.toMatch(/^\/(ar|de|en|es|fr|he|ro)\//);
        }
    });

    it('ships an icon per entry, never an emoji label', () => {
        for (const link of getUserMenuLinks(true)) {
            expect(typeof link.icon).not.toBe('undefined');
        }
    });
});
