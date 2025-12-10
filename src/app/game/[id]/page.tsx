'use client';

import { useParams, useRouter } from 'next/navigation';
import { useGameLogic } from '@/hooks/useGameLogic';
// Header and Input fixed positioning removed in favor of Flexbox
import { GameHeader } from '@/components/game/GameHeader';
import { ChatArea } from '@/components/game/ChatArea';
import { GameInput } from '@/components/game/GameInput';
import { EndGamePopover } from '@/components/game/EndGamePopover';
import { useTurnNotifications } from '@/hooks/useTurnNotifications';


export default function GameRoom() {
    const { id } = useParams();
    const router = useRouter();
    const gameId = Array.isArray(id) ? id[0] : id;

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
        justSolvedData
    } = useGameLogic(gameId!);

    // Notification Logic
    const isMyTurn = game?.current_turn_user_id === user?.id;
    const targetMessage = getTargetMessage();
    // Guessing mode = solving status. Notification triggers when *my* message is the one being guessed.
    const isMyMessageBeingGuessed = game?.status === 'solving' && targetMessage?.user_id === user?.id;

    useTurnNotifications(!!isMyTurn, !!isMyMessageBeingGuessed);


    if (loading) return <div className="flex items-center justify-center h-screen">Loading Game...</div>;
    if (!game) return <div className="flex items-center justify-center h-[100dvh]">Game not found</div>;

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-white dark:bg-gray-900 relative max-w-md mx-auto">
            <GameHeader
                game={game}
                user={user}
                players={players}
                loading={loading}
                proposalTimeLeft={proposalTimeLeft}
                solvingTimeLeft={solvingTimeLeft}
                targetMessage={getTargetMessage()}
                messageCount={messages.length}
                onBack={() => router.push('/')}
                onRefresh={fetchGameData}
                onProposeSolving={proposeSolvingMode}
                onConfirmSolving={confirmSolvingMode}
                onDenySolving={denySolvingMode}
            />

            <ChatArea
                messages={messages}
                user={user}
                game={game}
                messagesEndRef={messagesEndRef}
                targetMessage={getTargetMessage()}
                shakeMessageId={shakeMessageId}
                justSolvedData={justSolvedData}
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
            />

            <EndGamePopover
                open={game.status === 'completed'}
                onClose={() => router.push('/')}
                players={players}
                messages={messages}
            />
        </div>
    );
}
