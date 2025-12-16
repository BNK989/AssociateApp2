export default function TermsPage() {
    return (
        <div className="container mx-auto py-12 px-4 max-w-3xl">
            <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
            <p className="mb-4 text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

            <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                    <p className="text-muted-foreground">
                        By accessing or using the Word Association Game, you agree to be bound by these Terms of Service.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">2. User Conduct</h2>
                    <p className="text-muted-foreground">
                        You agree to use the service only for lawful purposes and in a way that does not infringe the rights of,
                        restrict or inhibit anyone else's use and enjoyment of the service.
                        <br /><br />
                        Harassment, hate speech, and abusive behavior in game chats will not be tolerated.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">3. Disclaimer</h2>
                    <p className="text-muted-foreground">
                        The game is provided "as is" without any representations or warranties, express or implied.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-3">4. Changes to Terms</h2>
                    <p className="text-muted-foreground">
                        We reserve the right to modify these terms at any time. We will notify users of any significant changes.
                    </p>
                </section>
            </div>
        </div>
    );
}
