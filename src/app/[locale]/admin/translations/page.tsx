import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCachedTranslatedDailyGame, translationContext } from '@/lib/dailyTranslation';
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

    // 4. Translation Check & Combine
    const processedGames = await Promise.all((games || []).map(async (game) => {
        // Check Hebrew translation
        // Use translationContext to set isPeek: true, so we don't trigger new translations
        let translated = null;
        try {
            await translationContext.run({ isPeek: true }, async () => {
                translated = await getCachedTranslatedDailyGame(
                    game.id,
                    game.words,
                    game.theme,
                    'he'
                );
            });
        } catch (e: any) {
            // If it's the specific peek error, we know it's a MISS
            if (e.message !== 'CACHE_MISS_PEEK') {
                console.error("Unexpected error in translation check:", e);
            }
            // Otherwise it remains null (Missing)
        }

        const logsForGame = generationLogs.filter(l => l.game_id === game.id && l.locale === 'he');

        return {
            ...game,
            hebrewTranslation: translated,
            generationCount: logsForGame.length,
            lastGeneratedAt: logsForGame.length > 0 ? logsForGame[0].generated_at : null // Assuming ordered or just take first
        };
    }));

    return (
        <div className="container mx-auto py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Daily Game Translation Cache Status (Hebrew)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableCaption>Showing games from {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Theme (EN)</TableHead>
                                <TableHead>Status (HE)</TableHead>
                                <TableHead>Cached At</TableHead>
                                <TableHead>Expires At (~)</TableHead>
                                <TableHead>Generations (DB)</TableHead>
                                <TableHead>Theme (HE)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedGames.map((game) => {
                                const isAvailable = !!game.hebrewTranslation;

                                let cachedAt = '-';
                                let expiresAt = '-';

                                if (game.hebrewTranslation?.cachedAt) {
                                    const cachedDate = new Date(game.hebrewTranslation.cachedAt);
                                    cachedAt = cachedDate.toLocaleString();

                                    // Calculate expiry: cachedAt + 24 hours
                                    const expiryDate = new Date(cachedDate.getTime() + 86400 * 1000);
                                    expiresAt = expiryDate.toLocaleString();
                                } else if (isAvailable) {
                                    cachedAt = 'Unknown / Pre-existing';
                                    expiresAt = 'Unknown';
                                }

                                return (
                                    <TableRow key={game.id}>
                                        <TableCell className="font-medium">{game.play_date}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{game.id.substring(0, 8)}...</TableCell>
                                        <TableCell>{game.theme}</TableCell>
                                        <TableCell>
                                            {isAvailable ?
                                                <Badge variant="default" className="bg-green-600 hover:bg-green-700">Available</Badge> :
                                                <Badge variant="secondary">Missing</Badge>
                                            }
                                        </TableCell>
                                        <TableCell className="text-sm">{cachedAt}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{expiresAt}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${game.generationCount > 1 ? 'text-red-500' : (game.generationCount === 1 ? 'text-green-600' : 'text-gray-400')}`}>
                                                    {game.generationCount}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell dir="rtl">{game.hebrewTranslation?.theme || '-'}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
