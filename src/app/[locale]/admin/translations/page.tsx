import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCachedTranslatedDailyGame, translationContext, TranslatedGameData } from '@/lib/dailyTranslation';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = 'force-dynamic';

export default async function AdminTranslationsPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    // 1. Auth Check (Handled by Layout) - We Keep Server Client for data fetching though
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
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

    // 2. Data Fetching
    // Range: Today - 2 days to Today + 7 days
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 2);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);

    const { data: games, error } = await supabase
        .from('daily_games')
        .select('*')
        .gte('play_date', startDate.toISOString().split('T')[0])
        .lte('play_date', endDate.toISOString().split('T')[0])
        .order('play_date', { ascending: true });

    if (error) {
        return <div>Error loading games: {error.message}</div>;
    }

    // 3. Data Fetching - Logs (Wait for Promise.all map) - Optimization: Fetch all logs for date range first
    let generationLogs: any[] = [];
    try {
        const { data: logs } = await supabase
            .from('translation_generations')
            .select('game_id, locale, generated_at')
            .in('game_id', games?.map(g => g.id) || []);
        generationLogs = logs || [];
    } catch (e) {
        console.warn("Could not fetch generation logs (Table might be missing):", e);
    }

    const TARGET_LOCALES = ['he', 'ar', 'es', 'fr', 'de', 'ro'];

    // 4. Translation Check & Combine
    const processedGames = await Promise.all((games || []).map(async (game) => {
        const translations: Record<string, { available: boolean, theme: string | null, generationCount: number }> = {};

        for (const locale of TARGET_LOCALES) {
            // Check translation
            let translated: TranslatedGameData | null = null;
            try {
                // Use the return value to help TS correctly infer the type
                translated = await translationContext.run({ isPeek: true }, async () => {
                    return await getCachedTranslatedDailyGame(
                        game.id,
                        game.words,
                        game.theme,
                        locale
                    );
                }) as TranslatedGameData | null;
            } catch (e: any) {
                if (e.message !== 'CACHE_MISS_PEEK') {
                    console.error(`Unexpected error in ${locale} translation check:`, e);
                }
            }

            const logsForGame = generationLogs.filter(l => l.game_id === game.id && l.locale === locale);

            translations[locale] = {
                available: !!translated,
                theme: (translated as TranslatedGameData | null)?.theme || null,
                generationCount: logsForGame.length
            };
        }

        return {
            ...game,
            translations
        };
    }));

    return (
        <div className="container mx-auto py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Daily Game Translation Cache Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableCaption>Showing games from {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Theme (EN)</TableHead>
                                {TARGET_LOCALES.map(lang => (
                                    <TableHead key={lang} className="text-center uppercase">{lang}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedGames.map((game) => (
                                <TableRow key={game.id}>
                                    <TableCell className="font-medium">
                                        <div>{game.play_date}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{game.id.substring(0, 8)}</div>
                                    </TableCell>
                                    <TableCell>{game.theme}</TableCell>
                                    {TARGET_LOCALES.map(lang => {
                                        const status = game.translations[lang];
                                        return (
                                            <TableCell key={lang} className="text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    {status.available ?
                                                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">OK</Badge> :
                                                        <Badge variant="secondary">Missing</Badge>
                                                    }
                                                    {status.generationCount > 0 && (
                                                        <span className="text-[10px] text-muted-foreground" title="Generations">
                                                            Gen: {status.generationCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
