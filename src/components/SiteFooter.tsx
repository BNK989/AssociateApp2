"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";

export function SiteFooter() {
    const pathname = usePathname();

    // Don't show footer on game pages
    if (pathname?.startsWith("/game/")) {
        return null;
    }

    return (
        <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-6 mt-auto">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} Associate Game. All rights reserved.</p>
                    <div className="flex gap-4">
                        <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="hover:underline hover:text-foreground transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="/thank-you" className="hover:underline hover:text-foreground transition-colors">
                            Thank You
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden md:inline-block">
                        Have a suggestion?
                    </span>
                    <FeedbackForm />
                </div>
            </div>
        </footer>
    );
}
