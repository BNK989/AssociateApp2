import { Landmark, Star } from 'lucide-react';
import { useCountUp } from './useCountUp';

type ScoreCounterProps = {
    score: number;
    teamPot: number;
    isLeader: boolean;
    isSolving: boolean;
    showBank: boolean;
    solvedCount?: number;
    maxMessages?: number;
    onClick: () => void;
};

/** Personal score, progress counter and team bank, all animated on change. */
export function ScoreCounter({
    score,
    teamPot,
    isLeader,
    isSolving,
    showBank,
    solvedCount,
    maxMessages,
    onClick,
}: ScoreCounterProps) {
    const displayScore = useCountUp(score);
    const displayPot = useCountUp(teamPot);

    // Mid-animation the number is briefly out of step with the real score,
    // which is what drives the green pop.
    const isCountingUp = displayScore !== score;

    return (
        <div
            className="flex flex-col items-end justify-center me-2 leading-none cursor-pointer"
            onClick={onClick}
        >
            {isSolving && (
                <div className={`flex items-center gap-1 font-bold transition-all duration-300 ${isLeader ? 'text-amber-500 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    <Star className={`w-3.5 h-3.5 ${isLeader ? 'fill-current' : ''}`} />
                    <span className={`text-base leading-none transition-all duration-300 ${isCountingUp ? 'scale-125 text-green-500' : ''}`}>
                        {displayScore}
                    </span>
                </div>
            )}

            <div className="flex items-center gap-2 mt-1">
                {maxMessages && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        {solvedCount || 0}/{maxMessages}
                    </span>
                )}

                {showBank && (
                    <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold opacity-80 text-[10px]">
                        <Landmark className="w-3 h-3" />
                        <span>{displayPot}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
