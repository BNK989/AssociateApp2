import { Link } from "@/navigation"; // Use localized Link
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function ThankYouPage() {
    const t = useTranslations('ThankYou');
    return (
        <div className="container mx-auto py-20 px-4 flex flex-col items-center justify-center text-center min-h-[60vh]">
            <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                {t('title')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mb-4">
                {t('message')}
            </p>
            <p className="text-xl text-muted-foreground max-w-md mb-8">
                {t.rich('special_thanks', {
                    maya: (chunks) => <em>{chunks}</em>,
                    tom: (chunks) => <em>{chunks}</em>
                })}
            </p>

            <div className="flex gap-4">
                <Link href="/">
                    <Button size="lg">{t('home_button')}</Button>
                </Link>
                {/* Cleaned up unused link */}
            </div>
        </div>
    );
}
