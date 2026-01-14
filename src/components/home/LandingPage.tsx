'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthProvider';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import GameDemo from './GameDemo';
import AuthForm from './AuthForm';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from '../../navigation'; // Use localized router
import { useState, useEffect } from 'react';

function DailyChallengeButton() {
    const t = useTranslations('HomePage.hero');
    const [isCompleted, setIsCompleted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Simple client-side check for today's completion
        // Note: This relies on client date matching server date logic roughly
        const today = new Date().toISOString().split('T')[0];
        const completed = localStorage.getItem(`daily_game_completed_${today}`);
        if (completed === 'true') {
            setIsCompleted(true);
        }
    }, []);

    const handleClick = () => {
        setIsLoading(true);
        router.push('/daily');
    };

    return (
        <Button
            size="lg"
            onClick={handleClick}
            disabled={isLoading}
            className={`group relative overflow-hidden transition-all duration-300 ${isCompleted
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg hover:shadow-orange-500/25 border-0 ring-2 ring-orange-400/20'
                }`}
        >
            {isLoading ? (
                <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('daily_loading')}
                </>
            ) : isCompleted ? (
                <>
                    <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                    {t('daily_completed')}
                </>
            ) : (
                <>
                    <Calendar className="w-5 h-5 mr-2" />
                    {t('daily_button')}
                    <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 transition-transform rtl:rotate-180 rtl:mr-2 rtl:ml-0" />
                    <span className="absolute inset-0 rounded-md ring-2 ring-white/20 group-hover:ring-white/40 transition-all" />
                </>
            )}
        </Button>
    );
}

export default function LandingPage() {
    const { loading } = useAuth();
    const t = useTranslations('HomePage');

    if (loading) return null; // Or a splash screen

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col">
            {/* Header / Nav */}
            <header className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <img src="/icon-192x192.png" alt="Associate Icon" className="w-8 h-8 rounded-lg" />
                    <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent font-bold text-xl">
                        {t('title')}
                    </span>
                </div>
                <button
                    onClick={() => document.getElementById('auth-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                    {t('login')}
                </button>
            </header>

            <main className="flex-1 flex flex-col lg:flex-row items-center justify-center container mx-auto px-4 max-w-6xl gap-12 lg:gap-24 py-8 lg:py-0">
                {/* Visual / Marketing Column */}
                <div className="flex-1 w-full space-y-8 flex flex-col items-center lg:items-start text-center lg:text-start">
                    <div className="space-y-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-block"
                        >
                            <Badge variant="secondary" className="px-3 py-1 rounded-full text-sm font-medium border-primary/20 bg-primary/5 text-primary">
                                {t('hero.badge')}
                            </Badge>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl lg:text-6xl font-extrabold tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70"
                        >
                            {t('hero.title_line1')}<br />
                            <span className="text-primary">{t('hero.title_line2')}</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0"
                        >
                            {t.rich('hero.description', {
                                none: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                                wordle: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                                codenames: (chunks) => <strong className="text-foreground">{chunks}</strong>
                            })}
                        </motion.p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="flex flex-col sm:flex-row items-center gap-4 justify-center"
                    >
                        <DailyChallengeButton />
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => document.getElementById('auth-form')?.scrollIntoView({ behavior: 'smooth' })}
                            className="bg-transparent border-primary/20 hover:bg-primary/5 hover:border-primary/40 text-foreground min-w-[200px]"
                        >
                            <span className="mr-2 rtl:ml-2 rtl:mr-0">{t('hero.login_button')}</span>
                            <ArrowRight className="w-4 h-4 opacity-70 rtl:rotate-180" />
                        </Button>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-full max-w-md mx-auto lg:mx-0"
                    >
                        {/* Demo Component */}
                        <GameDemo />
                    </motion.div>
                </div>

                {/* Login / Action Column */}
                <motion.div
                    id="auth-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex-1 w-full max-w-md bg-card border rounded-2xl p-6 lg:p-8 shadow-xl backdrop-blur-sm"
                >
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-bold mb-2">{t('auth_form.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('auth_form.subtitle')}</p>
                    </div>

                    <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
                        <AuthForm />
                    </Suspense>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/40 mt-auto">
                <p>{t('footer', { year: new Date().getFullYear() })}</p>
            </footer>
        </div >
    );
}
