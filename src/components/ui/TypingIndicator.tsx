import React from "react";
import { motion } from "framer-motion";

export const TypingIndicator = () => {
    return (
        <div className="flex items-center space-x-1 px-4 py-3 bg-muted/50 rounded-2xl w-fit">
            <motion.div
                className="w-1.5 h-1.5 bg-foreground/50 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            />
            <motion.div
                className="w-1.5 h-1.5 bg-foreground/50 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
                className="w-1.5 h-1.5 bg-foreground/50 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
            />
        </div>
    );
};
