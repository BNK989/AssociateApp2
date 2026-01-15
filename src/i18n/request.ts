import { getRequestConfig } from 'next-intl/server';
import { routing } from '../proxy'; // We will define routing in proxy.ts

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = await requestLocale;

    // Ensure that a valid locale is used
    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    let messages;
    try {
        messages = (await import(`../../messages/${locale}.json`)).default;
    } catch (error) {
        // Fallback to English if translation file missing
        messages = (await import(`../../messages/en.json`)).default;
    }

    return {
        locale,
        messages
    };
});
