import { getRequestConfig } from 'next-intl/server';
import { createLogger } from '@/lib/logger';
import { defaultLocale, isSupportedLocale } from './locales';

const log = createLogger('i18n/request');

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    const requested = await requestLocale;

    // `routing.locales` only lists languages with a messages file, so an
    // unsupported value here means a hand-typed URL or a stale link.
    let locale = defaultLocale;
    if (isSupportedLocale(requested)) {
        locale = requested;
    } else if (requested) {
        log.warn('resolve_locale', `Unsupported locale "${requested}" requested, serving ${defaultLocale}`, {
            requested_locale: requested,
            fallback_locale: defaultLocale,
        });
    }

    let messages;
    try {
        messages = (await import(`../../messages/${locale}.json`)).default;
    } catch (error) {
        // Should be unreachable: every entry in `locales` has a messages file.
        // If it fires, `messages/<locale>.json` is missing from the build.
        log.error(
            'load_messages',
            `Missing messages/${locale}.json, falling back to ${defaultLocale} copy`,
            { locale, fallback_locale: defaultLocale },
            error,
        );
        messages = (await import(`../../messages/${defaultLocale}.json`)).default;
    }

    return {
        locale,
        messages
    };
});
