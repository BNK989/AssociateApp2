'use client';

import { useVisualViewport } from '@/hooks/useVisualViewport';
import { GameBackground } from './GameBackground';

type GameShellProps = {
    children: React.ReactNode;
};

/**
 * The frame both game modes render into.
 *
 * On a phone this is the whole viewport, which is what the game was designed
 * for and what the overwhelming majority of players see. On a wide screen the
 * same column would be a 448px strip floating in dead space, so from `md` up it
 * becomes a card inset from the edges, and the ambient background moves out
 * behind it to fill the room.
 *
 * The height is driven by `useVisualViewport` rather than `100dvh` because the
 * mobile keyboard must shrink the board instead of pushing the input off
 * screen; on desktop the two are equivalent.
 */
export function GameShell({ children }: GameShellProps) {
    const viewportHeight = useVisualViewport();

    return (
        <div className="fixed inset-0 z-50 overflow-hidden" style={{ height: viewportHeight }}>
            {/* Desktop only: the panel copy inside the chat list still serves phones. */}
            <div className="hidden md:block absolute inset-0 z-0" aria-hidden="true">
                <GameBackground variant="room" />
            </div>

            <div className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-white dark:bg-gray-900 md:my-6 md:h-[calc(100%-3rem)] md:max-w-xl md:rounded-2xl md:border md:border-border md:shadow-2xl">
                {children}
            </div>
        </div>
    );
}
