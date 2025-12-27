import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/context/AuthProvider";
import { NavBar } from "@/components/NavBar";
import { DynamicToaster } from '@/components/DynamicToaster';
import { SiteFooter } from '@/components/SiteFooter';
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PostHogProvider } from "@/app/providers/PostHogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://associ8game.com'),
  title: {
    default: "Associ8 - The Multiplayer Word Association Game",
    template: "%s | Associ8"
  },
  description: "Challenge your friends in Associ8, the addictive real-time word association game. Connect words, steal points, and race to victory!",
  keywords: ["word game", "multiplayer", "word association", "party game", "online game", "associ8", "vocabulary", "puzzle"],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Associ8 - The Multiplayer Word Association Game",
    description: "Challenge your friends in Associ8, the addictive real-time word association game. Connect words, steal points, and race to victory!",
    url: "https://associ8game.com",
    siteName: "Associ8",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "Associ8 Game Logo",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Associ8 - The Multiplayer Word Association Game",
    description: "Challenge your friends in Associ8, the addictive real-time word association game.",
    images: ["/icon-512x512.png"],
  },
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground flex flex-col min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogProvider>
            <AuthProvider>
              <NavBar />
              <main className="flex-1 w-full">
                {children}
              </main>
              <SiteFooter />
              <DynamicToaster />
              <ServiceWorkerRegister />
            </AuthProvider>
          </PostHogProvider>
        </ThemeProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Associ8",
              "applicationCategory": "GameApplication",
              "operatingSystem": "Any",
              "description": "A multiplayer word association game where players connect unrelated words. Similar to popular word games like Connections and Wordle, but real-time and social.",
              "url": "https://associ8game.com",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "author": {
                "@type": "Organization",
                "name": "Note Late"
              }
            })
          }}
        />
      </body>
    </html>
  );
}
