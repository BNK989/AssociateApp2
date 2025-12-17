import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type StealAnimationProps = {
    stealerName: string;
    stealerAvatar?: string;
    authorName?: string;
    onComplete?: () => void;
};

export function StealAnimation({ stealerName, stealerAvatar, authorName = 'Someone', onComplete }: StealAnimationProps) {
    return (
        <div className="absolute top-20 left-0 right-0 z-40 overflow-hidden pointer-events-none pb-2 h-16 flex items-center">
            <motion.div
                initial={{ x: '100vw' }}
                animate={{ x: '-100%' }}
                transition={{
                    duration: 6,
                    ease: "linear",
                    repeat: 0
                }}
                onAnimationComplete={onComplete}
                className="flex items-center gap-3 whitespace-nowrap bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 w-fit"
            >
                <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6 border border-white/50">
                        <AvatarImage src={stealerAvatar} />
                        <AvatarFallback className="text-[10px] bg-indigo-500 text-white">
                            {stealerName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-amber-400 text-sm shadow-black drop-shadow-md">
                        {stealerName}
                    </span>
                </div>

                <span className="text-white text-sm font-medium">
                    solved
                </span>

                <span className="font-bold text-cyan-400 text-sm shadow-black drop-shadow-md">
                    {authorName === 'You' ? "your" : `${authorName}'s`}
                </span>

                <span className="text-white text-sm">
                    text
                </span>
            </motion.div>
        </div>
    );
}
