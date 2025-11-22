'use client';

import { useParams, useRouter } from 'next/navigation';
import { useGameLogic } from '@/hooks/useGameLogic';
import { GameHeader } from '@/components/game/GameHeader';
import { ChatArea } from '@/components/game/ChatArea';
import { GameInput } from '@/components/game/GameInput';
import { EndGamePopover } from '@/components/game/EndGamePopover';

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
        handleGetHint,
        getTargetMessage,
        shakeMessageId,
        justSolvedMessageId
    } = useGameLogic(gameId!);

    if (loading) return <div className="flex items-center justify-center h-screen">Loading Game...</div>;
    if (!game) return <div className="flex items-center justify-center h-[100dvh]">Game not found</div>;

    return (
        <div className="min-h-screen max-w-md mx-auto bg-white dark:bg-gray-900 relative">
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
                onDenySolving={denySolvingMode}
            />

            <ChatArea
                messages={messages}
                user={user}
                game={game}
                messagesEndRef={messagesEndRef}
                targetMessage={getTargetMessage()}
                shakeMessageId={shakeMessageId}
                justSolvedMessageId={justSolvedMessageId}
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
