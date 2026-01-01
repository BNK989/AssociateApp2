import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export type AnimationData = {
    type: 'steal';
    stealerName: string;
    stealerAvatar?: string;
    authorName?: string;
} | {
    type: 'announcement';
    message: string;
    subMessage?: string;
    icon?: string;
};

type FloatingMessageProps = {
    data: AnimationData;
    onComplete?: () => void;
};

export function FloatingMessage({ data, onComplete }: FloatingMessageProps) {
    return (
        <div className="absolute top-20 left-0 right-0 z-40 overflow-hidden pointer-events-none pb-2 h-16 flex items-center">
            <motion.div
                initial={{ x: '100vw' }}
                animate={{ x: '-100%' }}
                transition={{
                    duration: data.type === 'steal' ? 6 : 8,
                    ease: "linear",
                    repeat: 0
                }}
                onAnimationComplete={onComplete}
                className="flex items-center gap-3 whitespace-nowrap bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 w-fit"
            >
                {data.type === 'steal' ? (
                    <>
                        <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6 border border-white/50">
                                <AvatarImage src={data.stealerAvatar} />
                                <AvatarFallback className="text-[10px] bg-indigo-500 text-white">
                                    {data.stealerName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-amber-400 text-sm shadow-black drop-shadow-md">
                                {data.stealerName}
                            </span>
                        </div>

                        <span className="text-white text-sm font-medium">
                            solved
                        </span>

                        <span className="font-bold text-cyan-400 text-sm shadow-black drop-shadow-md">
                            {data.authorName === 'You' ? "your" : `${data.authorName}'s`}
                        </span>

                        <span className="text-white text-sm">
                            text
                        </span>
                    </>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-xl animate-bounce">{data.icon || '📢'}</span>
                        <div className="flex flex-col">
                            <span className="font-bold text-white text-sm shadow-black drop-shadow-md">
                                {data.message}
                            </span>
                            {data.subMessage && (
                                <span className="text-amber-300 text-xs font-medium shadow-black drop-shadow-md">
                                    {data.subMessage}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
