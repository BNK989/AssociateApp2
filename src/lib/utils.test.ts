
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getURL } from './utils';

describe('getURL', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.unstubAllGlobals();
    });

    it('should return window.location.origin on client side', () => {
        vi.stubGlobal('window', {
            location: {
                origin: 'http://client-side.com',
            },
        });

        expect(getURL()).toBe('http://client-side.com');
        expect(getURL('/path')).toBe('http://client-side.com/path');
    });

    it('should use NEXT_PUBLIC_SITE_URL on server side', () => {
        vi.stubGlobal('window', undefined);
        process.env.NEXT_PUBLIC_SITE_URL = 'https://production-site.com';

        expect(getURL()).toBe('https://production-site.com');
        expect(getURL('/auth/callback')).toBe('https://production-site.com/auth/callback');
    });

    it('should use NEXT_PUBLIC_VERCEL_URL if SITE_URL is missing', () => {
        vi.stubGlobal('window', undefined);
        delete process.env.NEXT_PUBLIC_SITE_URL;
        process.env.NEXT_PUBLIC_VERCEL_URL = 'my-app.vercel.app';

        expect(getURL()).toBe('https://my-app.vercel.app');
    });

    it('should fallback to localhost if no env vars', () => {
        vi.stubGlobal('window', undefined);
        delete process.env.NEXT_PUBLIC_SITE_URL;
        delete process.env.NEXT_PUBLIC_VERCEL_URL;

        expect(getURL()).toBe('http://localhost:3000');
    });

    it('should ensure https for non-localhost URLs', () => {
        vi.stubGlobal('window', undefined);
        process.env.NEXT_PUBLIC_SITE_URL = 'my-site.com'; // No protocol

        expect(getURL()).toBe('https://my-site.com');
    });

    it('should handle trailing slashes correctly', () => {
        vi.stubGlobal('window', undefined);
        process.env.NEXT_PUBLIC_SITE_URL = 'https://site.com/'; // Trailing slash

        expect(getURL('/path')).toBe('https://site.com/path');
        expect(getURL('/')).toBe('https://site.com/');
    });
});
