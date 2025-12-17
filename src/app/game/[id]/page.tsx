'use client';




import { useParams, useRouter } from 'next/navigation';
import { useGameLogic } from '@/hooks/useGameLogic';
// Header and Input fixed positioning removed in favor of Flexbox
import { GameHeader } from '@/components/game/GameHeader';
import { ChatArea } from '@/components/game/ChatArea';
import { GameInput } from '@/components/game/GameInput';
import { EndGamePopover } from '@/components/game/EndGamePopover';
import { GameLoading } from '@/components/game/GameLoading';
import { useTurnNotifications } from '@/hooks/useTurnNotifications';
import { useVisualViewport } from '@/hooks/useVisualViewport';

import { toast } from "sonner";

export default function GameRoom() {
    const { id } = useParams();
    const router = useRouter();
    const gameId = Array.isArray(id) ? id[0] : id;
    const viewportHeight = useVisualViewport();

    const {
        user,
        game,
        messages,
        players,
        input,
        setInput,
        loading,
        messagesEndRef,
        proposalTimeLeft,
        solvingTimeLeft,
        sending,
        fetchGameData,
        handleSendMessage,
        proposeSolvingMode,
        denySolvingMode,
        confirmSolvingMode,
        handleGetHint,
        getTargetMessage,
        shakeMessageId,
        justSolvedData,
        startRandomGame,
        broadcastTyping,
        typingUsers,
        stealData,
        setStealData
    } = useGameLogic(gameId!);

    // Notification Logic
    const isMyTurn = game?.current_turn_user_id === user?.id;
    const targetMessage = getTargetMessage();
    // Guessing mode = solving status. Notification triggers when *my* message is the one being guessed.
    const isMyMessageBeingGuessed = game?.status === 'solving' && targetMessage?.user_id === user?.id;

    useTurnNotifications(!!isMyTurn, !!isMyMessageBeingGuessed);

    const handleLeaveGame = async () => {
        try {
            const response = await fetch(`/api/game/${gameId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'leave_game' })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to leave game');
            }

            toast.success("You have left the game.");
            router.push('/');
        } catch (error) {
            console.error(error);
            toast.error("Failed to leave game.");
        }
    };


    if (loading) return <GameLoading />;
    if (!game) return <div className="flex items-center justify-center h-[100dvh]">Game not found</div>;

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-gray-900 max-w-md mx-auto"
            style={{ height: viewportHeight }}
        >
            <GameHeader
                game={game}
                user={user}
                players={players}
                loading={loading}
                proposalTimeLeft={proposalTimeLeft}
                solvingTimeLeft={solvingTimeLeft}
                targetMessage={getTargetMessage()}
                onBack={() => router.push('/')}
                onLeave={handleLeaveGame}
                onRefresh={fetchGameData}
                onProposeSolving={proposeSolvingMode}
                onConfirmSolving={confirmSolvingMode}
                onDenySolving={denySolvingMode}
                messageCount={messages.length}
                maxMessages={game.max_messages}
            />

            <ChatArea
                messages={messages}
                user={user}
                game={game}
                messagesEndRef={messagesEndRef}
                targetMessage={getTargetMessage()}
                shakeMessageId={shakeMessageId}
                justSolvedData={justSolvedData}
                onStartRandom={startRandomGame}
                typingUsers={typingUsers}
                players={players}
                stealData={stealData}
                onStealAnimationComplete={() => setStealData(null)}
            />

            <GameInput
                game={game}
                user={user}
                players={players}
                input={input}
                setInput={setInput}
                sending={sending}
                solvingTimeLeft={solvingTimeLeft}
                targetMessage={getTargetMessage()}
                onSendMessage={handleSendMessage}
                onGetHint={handleGetHint}
                isEmpty={messages.length === 0}
                onTyping={broadcastTyping}
            />

            <EndGamePopover
                open={game.status === 'completed'}
                onClose={() => router.push('/')}
                players={players}
                messages={messages}
                gameId={game.id}
                gameHandle={game.handle}
                teamPot={game.team_pot}
            />
        </div>
    );
}
