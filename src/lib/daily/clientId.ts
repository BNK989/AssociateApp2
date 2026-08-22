import { createLogger } from '@/lib/logger';

const log = createLogger('daily/client-id');

const STORAGE_KEY = 'associ8-client-id';

/**
 * A stable per-browser id, used to attribute daily results.
 *
 * Guests in this app are not anonymous auth users -- they have no session at
 * all -- so `auth.uid()` identifies only the registered minority. Measuring
 * where players abandon a chain means counting the guests too, and this is the
 * only handle we have on them.
 *
 * It identifies a browser, never a person: it is not sent anywhere except our
 * own result endpoint, and clearing site data mints a new one.
 *
 * Returns null when storage is unavailable (private mode, storage disabled).
 * That is not an error worth surfacing to a player -- we simply record nothing
 * for that session.
 */
export function getClientId(): string | null {
    try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) return existing;

        const minted = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, minted);
        return minted;
    } catch (e) {
        log.warn('mint', 'Storage is unavailable, so this session records no daily result', undefined, e);
        return null;
    }
}
