'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { User, Sparkles } from 'lucide-react';

const messages = [
    { id: 1, text: "Hint: Use one word to describe 'Summer'", type: 'system', delay: 0 },
    { id: 2, text: "Hot", type: 'user', user: 'Alex', delay: 1.5, align: 'left' },
    { id: 3, text: "Sun", type: 'user', user: 'Sam', delay: 2.5, align: 'right' },
    { id: 4, text: "Beach", type: 'user', user: 'Jordan', delay: 3.5, align: 'left' },
    { id: 5, text: "Nice! +10 Points", type: 'success', delay: 4.5 },
];

export default function GameDemo() {
    const [visibleMessages, setVisibleMessages] = useState<number[]>([]);

    useEffect(() => {
        const timeouts = messages.map((msg) => {
            return setTimeout(() => {
                setVisibleMessages((prev) => [...prev, msg.id]);
            }, msg.delay * 1000);
        });

        const resetTimeout = setTimeout(() => {
            setVisibleMessages([]);
            // Loop simply by clearing and letting the effect re-run if we added a dependency on a "loop" state,
            // but for simplicity, let's just let it stick or restart.
            // To restart properly we'd need a state trigger.
        }, 8000);

        return () => {
            timeouts.forEach(clearTimeout);
            clearTimeout(resetTimeout);
        };
    }, []);

    // Simple loop effect
    const [loop, setLoop] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => {
            setLoop(l => l + 1);
            setVisibleMessages([]);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    // Re-trigger the initial sequence when loop changes
    useEffect(() => {
        const timeouts = messages.map((msg) => {
            return setTimeout(() => {
                setVisibleMessages((prev) => [...prev, msg.id]);
            }, msg.delay * 1000);
        });
        return () => timeouts.forEach(clearTimeout);
    }, [loop]);

    return (
        <div className="w-full max-w-sm mx-auto bg-card/50 backdrop-blur-sm border rounded-2xl shadow-xl overflow-hidden h-[400px] flex flex-col relative">
            <div className="bg-primary/10 p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-mono text-muted-foreground">Lobby #12</span>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-hidden relative">
                {messages.map((msg) => (
                    visibleMessages.includes(msg.id) && (
                        <motion.div
                            key={`${loop}-${msg.id}`}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={cn(
                                "flex w-full mb-2",
                                msg.type === 'system' || msg.type === 'success' ? "justify-center" :
                                    msg.align === 'right' ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm",
                                    msg.type === 'system' ? "bg-muted text-muted-foreground text-xs font-medium uppercase tracking-wider" :
                                        msg.type === 'success' ? "bg-green-500/10 text-green-600 border border-green-200 dark:border-green-900 font-bold flex items-center gap-2" :
                                            msg.align === 'right' ? "bg-primary text-primary-foreground rounded-br-sm" :
                                                "bg-secondary text-secondary-foreground rounded-bl-sm"
                                )}
                            >
                                {msg.type === 'user' && (
                                    <span className="block text-[10px] opacity-70 mb-1">{msg.user}</span>
                                )}
                                {msg.type === 'success' && <Sparkles className="w-3 h-3" />}
                                {msg.text}
                            </div>
                        </motion.div>
                    )
                ))}
            </div>

            {/* Fake Input Area */}
            <div className="p-3 border-t bg-background/50">
                <div className="h-10 bg-muted rounded-full w-full animate-pulse opacity-20" />
            </div>
        </div>
    );
}
