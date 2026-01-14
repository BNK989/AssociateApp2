"use client";

import { Link } from "@/navigation";
import { usePathname } from "@/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";
import { useTranslations } from "next-intl";
import { LanguagePicker } from "@/components/LanguagePicker";

export function SiteFooter() {
    const pathname = usePathname();
    const t = useTranslations('Footer');

    // Don't show footer on game pages
    if (pathname?.startsWith("/game/") || pathname?.startsWith("/daily")) {
        return null;
    }

    return (
        <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-6 mt-auto">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-sm text-muted-foreground">
                    <p>{t('copyright', { year: new Date().getFullYear() })}</p>
                    <div className="flex gap-4">
                        <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">
                            {t('privacy')}
                        </Link>
                        <Link href="/terms" className="hover:underline hover:text-foreground transition-colors">
                            {t('terms')}
                        </Link>
                        <Link href="/thank-you" className="hover:underline hover:text-foreground transition-colors">
                            {t('thank_you')}
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <LanguagePicker variant="icon" />
                    <span className="text-sm text-muted-foreground hidden md:inline-block">
                        {t('suggestion')}
                    </span>
                    <FeedbackForm />
                </div>
            </div>
        </footer>
    );
}
