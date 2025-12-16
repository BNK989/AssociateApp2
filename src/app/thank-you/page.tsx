import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ThankYouPage() {
    return (
        <div className="container mx-auto py-20 px-4 flex flex-col items-center justify-center text-center min-h-[60vh]">
            <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Thank You!
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mb-4">
                We rely on players like you to make this game better.
                Thank you for playing and being part of our community.
            </p>
            <p className="text-xl text-muted-foreground max-w-md mb-8">
                Special thanks to my siblings <em>Maya</em> and <em>Tom</em>, who gave me the idea for this game which we've played well in the past.
            </p>

            <div className="flex gap-4">
                <Link href="/">
                    <Button size="lg">Return Home</Button>
                </Link>
                <Link href="/feedback">
                    {/* Note: Feedback page doesn't exist as a standalone page in the plan, but maybe we can link to home or trigger it? 
              For now keeping it simple or maybe removing this link if Feedback is a modal. 
              Let's just keep Return Home.
          */}
                </Link>
            </div>
        </div>
    );
}
