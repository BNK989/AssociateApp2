import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import DailyGameClient from './DailyGameClient';
import { notFound } from 'next/navigation';
import { createLogger } from '@/lib/logger';
import { getDailyHintSettings } from '@/lib/gameSettings/server';
import { defaultLocale, isSupportedLocale } from '@/i18n/locales';
import type { TranslatedGameData } from '@/lib/dailyTranslation';

const log = createLogger('daily/page');

export const dynamic = 'force-dynamic';

export default async function DailyGamePage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch today's daily game (Base English Data)
    const { data: initialDailyGame, error } = await supabase
        .from('daily_games')
        .select('*')
        .eq('play_date', todayStr)
        .single();

    let dailyGame = initialDailyGame;

    if (error || !dailyGame) {
        log.warn('load_game', 'No pre-planned daily game found, falling back to generation', { play_date: todayStr }, error);
        const { generateAndStoreDailyGame } = await import('@/lib/dailyGameGenerator');
        dailyGame = await generateAndStoreDailyGame(todayStr);
    }

    if (dailyGame && (!dailyGame.hints || !Array.isArray(dailyGame.hints) || dailyGame.hints.length !== dailyGame.words.length)) {
        const { ensureDailyHints } = await import('@/lib/dailyHintUtils');
        const generatedResult = await ensureDailyHints(dailyGame.id, dailyGame.words, dailyGame.theme);
        if (generatedResult) {
            // Handle both legacy (array) and new (object) returns
            if (Array.isArray(generatedResult)) {
                dailyGame.hints = generatedResult;
            } else {
                dailyGame.hints = generatedResult.hints;
                dailyGame.connection_scores = generatedResult.connectionScores;
            }
        }
    }

    if (!dailyGame) {
        log.error('load_game', 'Unable to load or generate a daily game', { play_date: todayStr });
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
                <h1 className="text-2xl font-bold mb-4">No Daily Game Available</h1>
                <p>Please try refreshing the page!</p>
            </div>
        );
    }

    // --- Translation Logic ---
    // Daily puzzle content is translated at runtime for every shipped locale
    // (CLAUDE.md §6). Anything else falls back to the English content.
    const targetLocale = isSupportedLocale(locale) ? locale : defaultLocale;

    if (targetLocale !== 'en') {
        const { getCachedTranslatedDailyGame } = await import('@/lib/dailyTranslation');
        const { checkTranslationScript } = await import('@/lib/daily/translationScript');

        // Use the cache-wrapped translation. A rejected translation throws
        // rather than returning, so the bad payload never enters the 24h cache;
        // this request simply serves the English chain.
        let translated: TranslatedGameData | null = null;
        try {
            translated = await getCachedTranslatedDailyGame(
                dailyGame.id,
                dailyGame.words,
                dailyGame.theme,
                targetLocale
            );
        } catch (e) {
            log.warn('translate', 'Translation rejected, serving the English chain for this request', { play_date: todayStr, locale: targetLocale }, e);
        }

        if (!translated) {
            log.warn('translate', 'No translation available, falling back to English', { play_date: todayStr, locale: targetLocale });
        }

        // Re-checked on the way out as well as on the way in: the data cache
        // survives deploys, so an entry written before the script guard existed
        // (a Hebrew chain carrying Arabic words, say) would otherwise still be
        // served for the rest of its 24h life.
        if (translated) {
            const check = checkTranslationScript(translated, targetLocale, dailyGame.words.length);
            if (!check.ok) {
                log.error('translate', 'Cached translation failed the script check, serving English instead', {
                    play_date: todayStr,
                    locale: targetLocale,
                    game_id: dailyGame.id,
                    reasons: check.reasons.join(' | '),
                });
                translated = null;
            }
        }

        if (translated) {
            dailyGame.theme = translated.theme;
            dailyGame.words = translated.words;
            dailyGame.hints = translated.hints;
        }
    }

    // Read on the server so the board is built with the right hint levels from
    // the first paint — resolving this on the client would show the default
    // policy first and then rewrite the board underneath the player.
    const hintSettings = await getDailyHintSettings();

    return (
        <DailyGameClient
            dailyWords={dailyGame.words || []}
            date={dailyGame.play_date}
            theme={dailyGame.theme}
            initialHints={dailyGame.hints}
            initialConnectionScores={dailyGame.connection_scores}
            hintSettings={hintSettings}
        />
    );
}
