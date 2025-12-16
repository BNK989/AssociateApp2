export default function PrivacyPage() {
    return (
        <div className="container mx-auto py-12 px-4 max-w-3xl">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <p className="mb-4 text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

            <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                    <p className="text-muted-foreground">
                        We collect minimal information necessary to provide the Word Association Game service.
                        This includes your email address (if you provide it for feedback or authentication) and game data
                        generated during your play sessions. We may also collect technical data using third-party tools to ensure reliability.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                    <p className="text-muted-foreground">
                        We use your information to:
                        <ul className="list-disc list-inside ml-4 mt-2">
                            <li>Provide and maintain the game service.</li>
                            <li>Improve game mechanics and user experience.</li>
                            <li>Respond to your feedback and requests.</li>
                            <li>Analyze usage patterns and debug issues.</li>
                            <li>Future marketing and promotional activities.</li>
                        </ul>
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">3. Data Security</h2>
                    <p className="text-muted-foreground">
                        We implement appropriate security measures to protect your personal information.
                        However, no method of transmission over the Internet is 100% secure.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">4. Analytics and Third-Party Tools</h2>
                    <p className="text-muted-foreground">
                        We use PostHog and other third-party services for analytics, debugging, and to maintain service reliability.
                        We reserve the right to use collected data for any purpose, including but not limited to marketing and service improvements, without limitation.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">5. Cookies</h2>
                    <p className="text-muted-foreground">
                        We use essential cookies to maintain your session and game state.
                        We may also use cookies from third-party services (like PostHog) to track usage behavior.
                    </p>
                </section>
            </div>
        </div>
    );
}
