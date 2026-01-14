import { useTranslations } from "next-intl";

export default function PrivacyPage() {
    const t = useTranslations('Privacy');

    return (
        <div className="container mx-auto py-12 px-4 max-w-3xl">
            <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
            <p className="mb-4 text-muted-foreground">{t('last_updated', { date: new Date().toLocaleDateString() })}</p>

            <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-3">{t('sections.1.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('sections.1.content')}
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">{t('sections.2.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('sections.2.content')}
                        <ul className="list-disc list-inside ml-4 mt-2">
                            <li>{t('sections.2.list.1')}</li>
                            <li>{t('sections.2.list.2')}</li>
                            <li>{t('sections.2.list.3')}</li>
                            <li>{t('sections.2.list.4')}</li>
                            <li>{t('sections.2.list.5')}</li>
                        </ul>
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">{t('sections.3.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('sections.3.content')}
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">{t('sections.4.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('sections.4.content')}
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">{t('sections.5.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('sections.5.content')}
                    </p>
                </section>
            </div>
        </div>
    );
}
