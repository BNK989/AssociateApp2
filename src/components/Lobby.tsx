'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthProvider';
import { useAdmin } from '@/hooks/useAdmin';
import GameCard from './GameCard';
import { OnboardingTutorial } from './OnboardingTutorial';
import { CreateGameDialog } from './lobby/CreateGameDialog';
import { DailyChallengeCard } from './lobby/DailyChallengeCard';
import { EmptyLobbyState } from './lobby/EmptyLobbyState';
import { LeaveGameDialog } from './lobby/LeaveGameDialog';
import { useCreateGame } from './lobby/useCreateGame';
import { useGameActions } from './lobby/useGameActions';
import { useLobbyGames } from './lobby/useLobbyGames';
import { useOnboarding } from './lobby/useOnboarding';
import type { LobbyGame } from './lobby/types';

/** Placeholder cards shown while the first fetch is in flight. */
function LobbySkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

export default function Lobby() {
    const { user } = useAuth();
    const { isAdmin } = useAdmin();
    const router = useRouter();
    const t = useTranslations('Lobby');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDailyCompleted, setIsDailyCompleted] = useState(false);
    const [isDailyLoading, setIsDailyLoading] = useState(false);

    const { activeGames, completedGames, loading } = useLobbyGames(user);
    const { creating, createGame } = useCreateGame(user);
    const { showTutorial, completeTutorial } = useOnboarding();

    // Optimistic removal; realtime will confirm it on the next fetch.
    const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
    const removeGame = useCallback((gameId: string) => {
        setRemovedIds((prev) => new Set(prev).add(gameId));
    }, []);

    const actions = useGameActions({ user, removeGame });

    // The daily result lives in localStorage, which is unavailable during SSR.
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setIsDailyCompleted(localStorage.getItem(`daily_game_completed_${today}`) === 'true');
    }, []);

    const visible = (games: LobbyGame[]) => games.filter((g) => !removedIds.has(g.id));
    const active = visible(activeGames);
    const completed = visible(completedGames);

    const renderCard = (game: LobbyGame) => (
        <GameCard
            key={game.id}
            game={game}
            onArchive={actions.archiveGame}
            onLeave={() => actions.setGameToLeave(game.id)}
            onDelete={actions.deleteGame}
            onReset={actions.resetGame}
            isAdmin={isAdmin}
        />
    );

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-purple-400">{t('title')}</h2>
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        disabled={creating}
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                        <Plus className="w-4 h-4 me-2" />
                        {t('new_game')}
                    </Button>
                </div>

                {loading ? (
                    <LobbySkeleton />
                ) : (
                    <>
                        <DailyChallengeCard
                            completed={isDailyCompleted}
                            loading={isDailyLoading}
                            onOpen={() => {
                                setIsDailyLoading(true);
                                router.push('/daily');
                            }}
                        />

                        {active.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {active.map(renderCard)}
                            </div>
                        ) : (
                            <EmptyLobbyState onCreateGame={() => setIsCreateOpen(true)} />
                        )}
                    </>
                )}
            </section>

            {completed.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold text-green-400 mb-6">{t('past_games')}</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {completed.map(renderCard)}
                    </div>
                </section>
            )}

            <LeaveGameDialog
                gameId={actions.gameToLeave}
                leaving={actions.leaving}
                onCancel={() => actions.setGameToLeave(null)}
                onConfirm={actions.confirmLeave}
            />

            <CreateGameDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                creating={creating}
                onCreate={async (modeId) => {
                    const gameId = await createGame(modeId);
                    if (gameId) setIsCreateOpen(false);
                }}
            />

            <OnboardingTutorial open={showTutorial} onComplete={completeTutorial} />
        </div>
    );
}
