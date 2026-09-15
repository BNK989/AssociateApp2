import type { Metadata } from 'next';
import { defaultLocale, isSupportedLocale } from '@/i18n/locales';
import { ogLocales, pageAlternates } from '@/lib/seo/siteUrls';
import LandingPage from '@/components/home/LandingPage';
import Lobby from "@/components/Lobby";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Declares which URL is the real one and what the other six languages are.
 * Without this the seven translations of the landing page read as duplicates
 * and a crawler keeps whichever it saw first.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: raw } = await params;
    const locale = isSupportedLocale(raw) ? raw : defaultLocale;

    return {
        alternates: pageAlternates(locale, ''),
        openGraph: { locale: ogLocales[locale] },
    };
}

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return <LandingPage />;
  }

  return (
    <div className="p-4">
      <Lobby />
    </div>
  );
}
