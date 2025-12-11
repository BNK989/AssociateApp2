import { motion } from "framer-motion";

export function GameLoading() {
    return (
        <div className="flex flex-col items-center justify-center h-[100dvh] bg-white dark:bg-gray-900 gap-8">
            <div className="relative">
                {/* Clean, scalable pulsing effect */}
                <motion.div
                    className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl"
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0.2, 0.5],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Icon Image */}
                <motion.img
                    src="/icon-192x192.png"
                    alt="Loading..."
                    className="w-24 h-24 rounded-2xl relative z-10"
                    animate={{
                        y: [-10, 10, -10],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            <div className="flex flex-col items-center gap-2">
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
                    Associate
                </h2>
                <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 rounded-full bg-purple-500"
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 1, 0.3],
                            }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.2,
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
